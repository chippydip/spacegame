package data

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
)

// Vector2D is a 2D-cartesian coordinate
type Vector2D struct {
	X, Y float64
}

// Orbit describes an elliptical path
type Orbit interface {
	Period() float64                       // in days
	PositionAt(julianDay float64) Vector2D // in AU relative to parent
}

// Base implementation of Orbit
type orbit struct {
	a      float64 // semi-major axis
	e      float64 // eccentricity
	pomega float64 // logitude of periapsis = longitude of ascending node + argument of periapsis
	m0     float64 // mean anomaly at epoch (J2000)
	n      float64 // mean angular motion (per day)
}

type jsonOrbit struct {
	A float64 `json:"a"`
	E float64 `json:"e"`
	P float64 `json:"pomega"`
	M float64 `json:"M0"`
	N float64 `json:"n"`
}

func (o *orbit) toJSON() jsonOrbit {
	return jsonOrbit{
		o.a,
		o.e,
		o.pomega,
		o.m0,
		o.n,
	}
}

// J2000 is the Julian Day reference point (January 1, 2000 at approximately 12:00 GMT)
const J2000 = 2451545.0

func (o *orbit) Period() float64 { return 2 * math.Pi / o.n }

func (o *orbit) PositionAt(julianDay float64) Vector2D {
	if o.a <= 0 {
		return Vector2D{}
	}

	// Current mean anomaly
	M := o.m0 + (julianDay-J2000)*o.n

	// Convert to eccentric anomaly
	E := M
	for i := 0; i < 10; i++ { // TODO: check convergence?
		E = M + o.e*math.Sin(E)
	}

	y := math.Sqrt(1-o.e) * math.Cos(E/2)
	x := math.Sqrt(1+o.e) * math.Sin(E/2)

	// Compute polar coordinate
	r := o.a * (1 - o.e*math.Cos(E))
	theta := o.pomega + 2*math.Atan2(y, x)

	// Convert to cartesian
	x = r * math.Cos(theta)
	y = r * math.Sin(theta)

	return Vector2D{x, y}
}

func NewOrbit(a, e, pomega, m0, n float64) orbit {
	return orbit{a, e, pomega, m0, n}
}

// Orbiter is an object that orbits around a central body
type Orbiter interface {
	Orbit
	Name() string
	Parent() Orbitable
	toOrbiter() *orbiter
}

// Base implementation of Orbiter
type orbiter struct {
	orbit
	name   string
	parent Orbitable
}

type jsonOrbiter struct {
	Name  string    `json:"name"`
	Orbit jsonOrbit `json:"orbit"`
}

func (o *orbiter) toJSON() jsonOrbiter {
	return jsonOrbiter{
		o.name,
		o.orbit.toJSON(),
	}
}

func (o *orbiter) Name() string        { return o.name }
func (o *orbiter) Parent() Orbitable   { return o.parent }
func (o *orbiter) toOrbiter() *orbiter { return o }

// Orbitable is an object that can be orbited around
type Orbitable interface {
	Orbiter
	Satellites() []Orbitable
	Radius() float64
	Mass() float64
	GM() float64
	SoiRadius() float64 // infinite for the sun? what about barycenters?
	toOrbitable() *orbitable
}

type orbitable struct {
	orbiter
	satellites []Orbitable
	radius     float64
	mass       float64
	soi        float64
}

type jsonOrbitable struct {
	Name   string      `json:"name"`
	Radius float64     `json:"radius"`
	Mass   float64     `json:"mass"`
	SOI    float64     `json:"soi"`
	Orbit  jsonOrbit   `json:"orbit"`
	Sats   []Orbitable `json:"satellites,omitempty"`
}

func (o *orbitable) toJSON() jsonOrbitable {
	return jsonOrbitable{
		o.name,
		o.radius,
		o.mass,
		o.soi,
		o.orbit.toJSON(),
		o.satellites,
	}
}

// G is the gravitational constant
const G = 6.6740831e-11

func (o *orbitable) Satellites() []Orbitable { return o.satellites }
func (o *orbitable) Radius() float64         { return o.radius }
func (o *orbitable) Mass() float64           { return o.mass }
func (o *orbitable) GM() float64             { return o.mass * G }
func (o *orbitable) SoiRadius() float64      { return o.soi }
func (o *orbitable) toOrbitable() *orbitable { return o }

// Barycenter is an Orbitable representing the shared center of mass of two bodies
type Barycenter struct {
	orbitable
}

func (o *Barycenter) MarshalJSON() ([]byte, error) {
	return json.Marshal(o.orbitable.toJSON())
}

// BodyType is the type of Body
type BodyType int

const (
	Star   BodyType = iota + 1
	Planet          // terrestrial vs gas giant?
	DwarfPlanet
	Moon
	Asteroid
	Comet
)

// Body is an Orbitable representing a Sun, Planet, Dwarf Planet, Moon, Asteroid, or Comet
type Body struct {
	orbitable
	btype BodyType
	// rotational period

	// declination
	// right accention
	// tilt

	// solar constant
	// mean temp
	// albedo
	// atm pressure
}

type jsonBody struct {
	Type BodyType `json:"type"`
	jsonOrbitable
}

func (o *Body) MarshalJSON() ([]byte, error) {
	return json.Marshal(jsonBody{
		o.btype,
		o.orbitable.toJSON(),
	})
}

// NewBody creates a new *Body object from the given parameters
func NewBody(btype BodyType, name string, radius, mass float64, obt orbit) *Body {
	b := &Body{}
	b.btype = btype
	b.name = name
	b.radius = radius
	b.mass = mass
	b.orbit = obt
	return b
}

// NewSystem creates a new System from the central bosy and list of satellites
func (centralBody *Body) NewSystem(satellites []Orbitable) System {
	if centralBody.satellites != nil {
		panic("Satellites already set")
	}

	sort.Sort(byA(satellites))

	var baryBody *orbitable
	barycenter := 0.0
	for _, s := range satellites {
		body := s.toOrbitable()
		body.parent = centralBody

		// Calculate SOI
		body.soi = body.a * math.Pow(body.mass/centralBody.mass, 0.4)

		// Calculate barycenter
		r := body.a / (1 + centralBody.mass/body.mass)
		if r > barycenter {
			barycenter = r
			baryBody = body
		}
	}

	if barycenter < 0.5*centralBody.Radius() {
		centralBody.soi = -1
		centralBody.satellites = satellites

		return centralBody
	}

	bc := &Barycenter{}
	inner := []Orbitable{}
	outer := []Orbitable{centralBody}

	for _, s := range satellites {
		body := s.toOrbitable()

		if body.a < baryBody.a-baryBody.soi {
			inner = append(inner, s) // orbit central body
		} else {
			outer = append(outer, s) // orbit barycenter
			body.parent = bc
		}
	}

	bc.satellites = outer
	bc.orbit = centralBody.orbit
	bc.name = fmt.Sprintf("%v-%v Barycenter", centralBody.name, baryBody.name)
	bc.radius = barycenter                     // ?
	bc.mass = centralBody.mass + baryBody.mass // ?
	bc.soi = -1

	centralBody.soi = baryBody.a - baryBody.soi
	centralBody.satellites = inner
	centralBody.orbit = baryBody.orbit
	centralBody.a = barycenter
	centralBody.m0 += math.Pi

	baryBody.a -= barycenter

	return bc
}

type byA []Orbitable

func (a byA) Len() int           { return len(a) }
func (a byA) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byA) Less(i, j int) bool { return a[i].toOrbiter().a < a[j].toOrbiter().a }

// System is the root Orbitable with a 0 orbit that contains all other bodies
type System Orbitable

// Ship is an Orbiter
type Ship struct { // also Missiles, etc?
	orbit
	// TODO
}

type jsonShip struct {
	Orbit jsonOrbit `json:"orbit"`
}

func (o *Ship) MarshalJSON() ([]byte, error) {
	return json.Marshal(jsonShip{
		o.orbit.toJSON(),
	})
}
