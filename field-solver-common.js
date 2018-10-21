/*******************
 * Dependencies 
 *******************/
if(typeof require !== 'undefined') {
    const glMatrix = require('gl-matrix')
    var vec2 = glMatrix.vec2
    var vec3 = glMatrix.vec3
    const field_solver_wasm = require('./dist/field-solver-wasm.wasm')

    //const fs = require('fs')
    //var Module = {}
    //fs.readFile('./dist/field-solver-wasm.wasm', (err, data) => {
      //WebAssembly.instantiate(data, Module)
    //})

    //var Module = require('./dist/field-solver-wasm.js')
    var Module = require('./dist/field-solver-wasm.js')({
        locateFile: function(s) {
            console.log('requested: ' + s)

            if(s.endsWith('.wasm')) {
                ////return './dist/' + s;

                const actual = __dirname + '/' + field_solver_wasm
                console.log('actually loading: ' + actual)
                return actual
            }
            return s
        }
    })
}

/***********************/
let wasm = false
let is_wasm = () => wasm
const WasmInitialized = new Promise((resolve, reject) => {
    Module['onRuntimeInitialized'] = resolve
}).then(x => {
  wasm = targetWasm
})


/************************
 * Functional utilities
 ************************/
const l_pad = (length, string) =>
    ('                   ' + string).slice(-parseInt(length, 10))

const small_fast_len2 = a => 
    Math.abs(a[0]) + Math.abs(a[1])

// Adapted from code by Doug Gwyn, http://c-faq.com/fp/fpequal.html
const RelDif = (a, b) => {
    let c = Math.abs(a)
    let d = Math.abs(b)

    d = Math.max(c, d)

    return d == 0.0 ? 0.0 : Math.abs(a - b) / d
}
const float_equal = (a, b) => RelDif(a, b) <= 0.01

const find_field = (() => {
    const direction = vec2.create()
    const field_i = [0,0]
    const field_output = [0,0]

    return position => {

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
})()

const triangle_area = (() => {
    const _AB_triangle_area = new Float32Array(3)
    const _AC_triangle_area = new Float32Array(3)
    const _product_triangle_area = new Float32Array(3)

    return (a, b, c) => {
        vec3.sub(_AB_triangle_area, b, a)
        vec3.sub(_AC_triangle_area, c, a)
        vec3.cross(
            _product_triangle_area, 
            _AB_triangle_area, 
            _AC_triangle_area
        )

        return vec3.len(_product_triangle_area) / 2;
    }
})()

console.assert(float_equal(
    triangle_area([0,0,1], [0,1,0], [0,0,0]), 
    0.5))



/*************
 * Constants
 *************/

let targetWasm = true

const N_SIG_FIGS = 6
const nabla = 10
const min_resolution = 3
const max_error_area = 0.25
const min_average_resolution = 100
const iterations = 6e7
const MAX_VERTICES_PER_LINE = Math.floor(Math.log2(iterations) * 25 / max_error_area)
//const charges = [
    //[-100, 0, +10],
     //[100, 0, -10],
//]
const charges = [
    [-100, 0, -10],
     [100, 0, -10],
     [0, -100, +10],
     [0, 100, +10]
    ]

/*********************************************
 * Implementations of the field line vertices
 *********************************************/

function wasm_generate_field_line_vertices(r_0, r_1, g_0) {
    const sizeof_float = 4
    const sizeof_double = 8
    const flat1 = x => x.reduce((acc, e) => acc.concat(e), [])

    //setup
    Module._set_nabla(nabla)
    Module._set_max_error_area(max_error_area )
    Module._set_min_average_resolution (min_average_resolution )
    Module._set_iterations (iterations )
    Module._set_MAX_VERTICES_PER_LINE(MAX_VERTICES_PER_LINE )

    const charges_ptr = Module._malloc(charges.length * 3 * sizeof_double)
    const flattened_charges = flat1(charges)
    Module.HEAPF64.set(flattened_charges, charges_ptr / sizeof_double)
    Module._set_charges (charges.length, charges_ptr)
    //end setup

    const ptr = Module._generate_field_line(r_0, r_1, g_0 )
    const n_vertices = Module.HEAPF32[ptr / sizeof_float] 
    const vertices = new Float32Array(Module.wasmMemory.buffer, ptr + (3 * sizeof_float), (n_vertices + 1) * 3)
    Module._free(ptr)

    return {
        vertices,
        n_vertices,
        iterations: Module.HEAPF32[ptr / sizeof_float + 1],
        time_ms: Module.HEAPF32[ptr / sizeof_float + 2]
    }
}
function js_generate_field_line_vertices(r_0, r_1, g_0) {
    const start_time = performance.now()
    
    const vertices = new Float32Array(3 * MAX_VERTICES_PER_LINE)

    let n_vertices = 0

    const r = Float32Array.of(r_0, r_1)
    let g = g_0

    const delta_r = Float32Array.of(0,0)

    vertices[0] = r[0]
    vertices[1] = g
    vertices[2] = r[1]
    n_vertices++


    let delta_pos_prev_prev = Float32Array.of(-1,-1,-1)
    let delta_pos_prev = Float32Array.of(1,1,1)
    let tmp

    let geometry_testing_start_i = 0
    let geometry_testing_start_vertex = 
            Float32Array.of(r_0, g_0 * 100, r_1)
    let geometry_testing_prev_vertex = new Float32Array(3)
    let geometry_testing_current_vertex = new Float32Array(3)

    let geometry_testing_error_area = 0


    let i = 0
    for (; i<iterations; i++) {
        const field = find_field(r)

        const mag_field = vec2.len(field)
        if(mag_field > 0.5) {
          if(i > geometry_testing_start_i) {
            vertices.set(geometry_testing_current_vertex, n_vertices * 3)
            n_vertices++
          }
          break
        }

        const mag_second_difference = vec3.distance(delta_pos_prev, delta_pos_prev_prev) || 1.0
        const mag_delta_pos_prev = vec3.length(delta_pos_prev)

        const factor = Math.pow(mag_delta_pos_prev / mag_second_difference, 1/2)

        vec2.scale
            ( delta_r
            , field, -nabla * factor) 
        vec2.add
            ( r
            , r, delta_r)

        const delta_g = vec2.dot(field, delta_r)
        g += delta_g
        
        
        tmp = delta_pos_prev
        delta_pos_prev = delta_pos_prev_prev // overridden on the next step
        delta_pos_prev_prev = tmp

        
        delta_pos_prev[0] = delta_r[0]
        delta_pos_prev[1] = delta_r[1]
        delta_pos_prev[2] = delta_g


        geometry_testing_current_vertex[0] = r[0]
        geometry_testing_current_vertex[1] = g * 100
        geometry_testing_current_vertex[2] = r[1]

        // aha! this can be done separately from the top! Need to get some
        // actual data on this
        if(i - geometry_testing_start_i > min_resolution) {

            geometry_testing_error_area += triangle_area(
                geometry_testing_start_vertex,
                geometry_testing_prev_vertex,
                geometry_testing_current_vertex)

            if(geometry_testing_error_area > max_error_area) {
                vertices.set(geometry_testing_prev_vertex, n_vertices * 3)
                n_vertices++

                geometry_testing_start_vertex.set(geometry_testing_prev_vertex, 0)
                geometry_testing_start_i = i - 1
                geometry_testing_error_area = 0

                //console.log(`pushed (${Math.floor(i/iterations * 100)}%): `, 
                    //r[0], g * 100, r[1], `field = ${field}`, `mag_field = ${mag_field}`)
            }
            
        }
        geometry_testing_prev_vertex.set(geometry_testing_current_vertex)
    }


    const end_time = performance.now()
    const time_ms = end_time - start_time

    console.log(
        `j Finished line w/ `
      + `${l_pad(Math.log10(iterations) + 1, i)} iter (rtm=${(i/iterations).toExponential(N_SIG_FIGS - 1)}), `       
      + `${n_vertices} vert, ` 
      + `(rtm=${(n_vertices / MAX_VERTICES_PER_LINE).toExponential(N_SIG_FIGS-1)}), `
      + `in ${Math.round(time_ms)} ms (${(time_ms * 10e6 / n_vertices).toExponential(N_SIG_FIGS - 1)} ns / vert).`
    )


    return {
      vertices,
      n_vertices,
      iterations: i,
      time_ms
    }
}

if(typeof module !== 'undefined') {
    module.exports = {
        ...exports,
        wasm_generate_field_line_vertices,
        js_generate_field_line_vertices,
        targetWasm,
        WasmInitialized,
        is_wasm
    }
}

