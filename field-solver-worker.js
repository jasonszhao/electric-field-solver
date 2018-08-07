let is_running = 0
var Module = {
  locateFile: function(s) {
    return 'dist/' + s;
  }
}
importScripts(
    './node_modules/gl-matrix/dist/gl-matrix.js', 
    './dist/field-solver-wasm.js',
    './field-solver-common.js',
)


// TODO: return a partially generated line, if it's taking a really long time

const generate_field_line_vertices = wasm 
    ? wasm_generate_field_line_vertices
    : js_generate_field_line_vertices



onmessage = async function onmessage(event) {
    if(is_running) 
        throw "already running. can't call me until I postMessage back!"

    is_running = true

    if(targetWasm && !wasm) 
        await WasmInitialized

    total_iterations = 0
    total_time_ms = 0
    total_vertices = 0

    const result = generate_field_line_vertices(...event.data)
    postMessage(result)
    is_running = false
}


// vim: shiftwidth=4
