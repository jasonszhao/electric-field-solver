/**********
 * State
 **********/
window.global_start_time = performance.now()
let resize_dirty = false

/************
 * END State
 ************/

const scene = new THREE.Scene()
scene.background = new THREE.Color( 0xdddddd )

const camera = new THREE.OrthographicCamera(
    window.innerWidth / - 2, 
    window.innerWidth / 2, 
    window.innerHeight / 2,
    window.innerHeight / - 2, 
    -1200, 
    100000 
)
camera.position.y = 100
camera.position.z = 500
camera.position.x = 100

const controls = new THREE.OrbitControls(camera)

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

/**********************************************************
 * Original Code by Matt Hobbs
 * released under Creative Commons Attribution International 4.0 (CC BY 4.0)
 * https://nooshu.github.io/lab/2011-05-15-debug-axes-in-three-js/
 *
 * I updated the code to work with newer versions of Three
 **********************************************************/
const debugaxis = function(axisLength){
    //Shorten the vertex function
    function v(x,y,z){
        return new THREE.Vector3(x,y,z)
    }

    //Create axis (point1, point2, colour)
    function createAxis(p1, p2, color){
        const lineGeometry = new THREE.Geometry()
        lineGeometry.vertices.push(p1, p2)
        const lineMat = new THREE.LineBasicMaterial({color: color, linewidth: 1})
        const line = new THREE.Line(lineGeometry, lineMat)
        scene.add(line)
    }

    createAxis(v(-axisLength, 0, 0), v(axisLength, 0, 0), 0xFF0000)
    createAxis(v(0, -axisLength, 0), v(0, axisLength, 0), 0x00FF00)
    createAxis(v(0, 0, -axisLength), v(0, 0, axisLength), 0x0000FF)
}

debugaxis(100)
/***************************************
 * END Code by Matt Hobbs
 ***************************************/


/***************************************
 * Animation
 ***************************************/
function animate() {
    if (resize_dirty) {
        renderer.setSize( window.innerWidth, window.innerHeight )
        camera.aspect = window.innerWidth / window.innerHeight
        camera.left = window.innerWidth / -2
        camera.right = window.innerWidth / 2
        camera.top = window.innerHeight / 2
        camera.bottom = window.innerHeight / -2
        camera.updateProjectionMatrix()

        resize_dirty = false
    }

    controls.update()
    renderer.render(scene, camera)

    window.requestAnimationFrame(animate)
}

window.addEventListener( 'resize', function onWindowResize() {
    resize_dirty = true
}, false)


//-----------

charges.forEach(c => {
    const geometry = new THREE.CylinderBufferGeometry( 1, 1, 800, 32 )
    const material = new THREE.MeshBasicMaterial( {color: 0xffff00} )
    const cylinder = new THREE.Mesh( geometry, material )
    cylinder.position.x = c[0]
    cylinder.position.z = c[1]
    scene.add(cylinder)
})


const geometries = []
let total_vertices = 0
let total_iterations = 0
let total_time_ms = 0


/**********************
 * "Worker" Management
 **********************/

const worker_manager = new WorkerManager()
const {worker_pool, queue, processed} = worker_manager
const queue_push = worker_manager.queue_push.bind(worker_manager)
const worker_add = worker_manager.worker_add.bind(worker_manager)

const n_workers = 70

for (let i=0; i<n_workers; i++) {
    worker_add(new HTTPWorker())
}

function BrowserWorker() {
    this._internal = new Worker('field-solver-worker.js')
    this.is_busy = flyd.stream(false)
}
BrowserWorker.prototype.run = function(args) {
    this._internal.postMessage(...args)

    return new Promise((resolve, reject) => {
        this._internal.onmessage = (event) => {
            resolve(event.data)
        }
    })
}

function HTTPWorker() {
    /*
    this._endpoint = location.hostname === "localhost"
        ? "//" + location.hostname + ":9000/generate_field_line_vertices"
        : "//" + location.host + "/.netlify/functions/generate_field_line_vertices"
    */
    this._endpoint = 
        "https://us-central1-electric-field-solver.cloudfunctions.net/field_line_vertices"
    this.is_busy = flyd.stream(true)

    axios.get(this._endpoint).then(() => { this.is_busy(false) })
}

HTTPWorker.prototype.run = function(args) {
    return axios.get(this._endpoint, 
                    {params: {r_0: args[0], r_1: args[1], g_0: args[2]}})
                .then(res => res.data)
}

/**********************
 * End Worker Management
 **********************/

function create_line(data) {
    const vertices = data.vertices instanceof Float32Array 
        ? vertices
        : Float32Array.from(data.vertices)
    const n_vertices = data.n_vertices

    total_vertices += n_vertices
    total_iterations += data.iterations
    total_time_ms += data.time_ms

    const material = new THREE.LineBasicMaterial({color: 0x0000ff})
    const geometry = new THREE.BufferGeometry()
    geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) )
    const line = new THREE.Line(geometry, material)
    scene.add(line)

    geometry.setDrawRange(0, n_vertices)
    geometries.push(geometry)
    return vertices
}


const promises = []
//**************
const starting_points = [] // Array([r[0], r[1], <-1 or 1>])
const lines_per_charge = 36
const distance_from_charge = 5
const centers = charges.filter(s => s[2] > 0)

//const starting_angle =  Math.PI * 5 / 6 
//const ending_angle = -Math.PI * 5 / 6

const starting_angle = 0
const ending_angle = Math.PI * 2

for(let i=0; i<lines_per_charge; i++) {
    const angle = starting_angle + i / lines_per_charge * (ending_angle - starting_angle)

    centers.forEach(center => {
        starting_points.push([
            center[0] + distance_from_charge * Math.cos(angle),
            center[1] + distance_from_charge * Math.sin(angle),
            1,
        ])
    })
}


starting_points.forEach(starting_point => {
    promises.push(queue_push([starting_point[0], starting_point[1], 0])
        .then(x => x.result)
        .then(create_line))
})


/************/

const get_vertices_export = () =>
    JSON.stringify(
        geometries.map(g => Array.from(
            g.attributes.position.array.slice(0, g.drawRange.count))))


function make_log_entry() {
    console.log("global_total_time: " + global_total_time)
    console.log({
        wasm: targetWasm,
        n_vertices: total_vertices,
        n_iterations: total_iterations,
        workers: n_workers,
        charges: charges,
        total_time: global_total_time,
        lines_per_charge: lines_per_charge,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
    })
}

let global_end_time 
let global_total_time
Promise.all(promises).then(values => {
    global_end_time = performance.now()
    global_total_time = global_end_time - global_start_time
  
    make_log_entry() 

    const avg_time_per_iteration_ns = 
        (total_time_ms * 10e6 / iterations).toExponential()

    console.log(
        `Finished all lines in ${global_total_time / 1000} s. \n` + 
        `   total_vertices=${total_vertices.toExponential()}, \n` +
        `   total_iterations=${total_iterations.toExponential()} \n` +
        `   average time / iteration = ${avg_time_per_iteration_ns} ns \n`
    ) 
})

animate()

