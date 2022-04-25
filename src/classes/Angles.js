export function vectorAngle(v) {
  const a = Math.atan2(v[1], v[0])
  if (a < 0) {
    return a+2*Math.PI
  } else {
    return a
  }
}

export function rotate(angle, theta) {
  return (angle + theta) % (Math.PI*2)
}

export function isAngleInRange(angle, range) {
  return isAngleBetween(range[0], range[1], angle)
}

export function isAngleBetween(a1, a2, a) {
  // Assumes angles are between 0 and 2π, checks if a between a1 and a2 in clockwise direction
  const doublePi = 2*Math.PI
  const addAngle = (doublePi - a1)
  a1 = (a1 + addAngle) % doublePi
  a2 = (a2 + addAngle) % doublePi
  a = (a + addAngle) % doublePi
  return a >= a1 && a <= a2 
}

export function angleRangeDistance(angle, range) {

  if (isAngleInRange(angle, range)) {
    return 0
  } else {
    return Math.min(
      angleDistance(angle, range[0]), 
      angleDistance(angle, range[1])
    )
  }
}

export function angleDistance(a1, a2) {
  // Unsigned
  const a = Math.abs(a1 - a2)
  return Math.min((2*Math.PI) - a, a)
}