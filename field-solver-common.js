
const l_pad = (length, string) =>
    ('                   ' + string).slice(-parseInt(length, 10))

const small_fast_len2 = a => 
    Math.abs(a[0]) + Math.abs(a[1])

const RelDif = (a, b) => {
    let c = Math.abs(a);
    let d = Math.abs(b);

    d = Math.max(c, d);

    return d == 0.0 ? 0.0 : Math.abs(a - b) / d;
}

const float_equal = (a, b) => RelDif(a, b) <= 0.01

const charges = [
    [-100, 0, -10],
     [100, 0, -10],
     [0, -100, +10],
     [0, 100, +10]
    ]


const direction = vec2.create()
const field_i = [0,0]
const field_output = [0,0]

const find_field = position => {
    field_output[0] = 0
    field_output[1] = 0

    for(let i = 0; i<charges.length; i++) {
        vec2.sub(direction, position, charges[i])
        
        const distance = vec2.len(direction)
        
        vec2.scale(field_i, direction, -charges[i][2] * Math.pow(distance, -3))
        
        vec2.add(field_output, field_output, field_i)
    }

    return field_output
}

const _AB_triangle_area = new Float32Array(3)
const _AC_triangle_area = new Float32Array(3)
const _product_triangle_area = new Float32Array(3)
const triangle_area = (a, b, c) => {
    vec3.sub(_AB_triangle_area, b, a)
    vec3.sub(_AC_triangle_area, c, a)
    vec3.cross(
        _product_triangle_area, 
        _AB_triangle_area, 
        _AC_triangle_area
    )

    return vec3.len(_product_triangle_area) / 2;
}

console.assert(float_equal(
    triangle_area([0,0,1], [0,1,0], [0,0,0]), 
    0.5))



/*************
 * Constants
 *************/


const N_SIG_FIGS = 6

const nabla = 10
const min_resolution = 3
const max_error_area = 0.25
const min_average_resolution = 100
const iterations = 6e7
const MAX_VERTICES_PER_LINE = Math.floor(Math.log2(iterations) * 25 / max_error_area)

