//const db = new PouchDB("benchmarks")
//const remoteCouch = 'http://127.0.0.1:5984/benchmarks';
window.global_start_time = performance.now()

const scene = new THREE.Scene()
scene.background = new THREE.Color( 0xdddddd );

let width = window.innerWidth
let height = window.innerHeight
const camera = new THREE.OrthographicCamera(
    width / - 2, 
    width / 2, 
    height / 2,
    height / - 2, 
    -1200, 
    100000 
)
camera.position.y = 100
camera.position.z = 500
camera.position.x = 100

const controls = new THREE.OrbitControls( camera );

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
var debugaxis = function(axisLength){
    //Shorten the vertex function
    function v(x,y,z){
            return new THREE.Vector3(x,y,z)
    }

    //Create axis (point1, point2, colour)
    function createAxis(p1, p2, color){
            var line, lineGeometry = new THREE.Geometry(),
            lineMat = new THREE.LineBasicMaterial({color: color, linewidth: 1});
            lineGeometry.vertices.push(p1, p2);
            line = new THREE.Line(lineGeometry, lineMat);
            scene.add(line);
    }

    createAxis(v(-axisLength, 0, 0), v(axisLength, 0, 0), 0xFF0000);
    createAxis(v(0, -axisLength, 0), v(0, axisLength, 0), 0x00FF00);
    createAxis(v(0, 0, -axisLength), v(0, 0, axisLength), 0x0000FF);
};

//To use enter the axis length
debugaxis(100);
/***************************************
 * END Code by Matt Hobbs
 ***************************************/


//let field
function animate() {
    controls.update();
    renderer.render(scene, camera)

    window.requestAnimationFrame(animate)
}



//-----------

charges.forEach(c => {
    const geometry = new THREE.CylinderBufferGeometry( 1, 1, 800, 32 );
    const material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
    const cylinder = new THREE.Mesh( geometry, material );
    cylinder.position.x = c[0]
    cylinder.position.z = c[1]
    scene.add( cylinder );
})


//const error_area = (points) => {
    //let area = 0;
    //const lines_per_charge = points.length

    //for(let i = 0; i<lines_per_charge; i++) {
        //a = points[i];
        //b = points[(i + 1) % lines_per_charge];
        //c = points[(i + 2) % lines_per_charge];

        //area += triangle_area(a, b, c);
    //}

    //return area;
//}

//https://threejs.org/docs/index.html#api/geometries/ParametricBufferGeometry


// generate some points
/**
 *  TODO: Make this work efficiently for straight lines. Currently, it maxes out
 *      the hard limit of iterations.
 */

/**
 *  DONE: figure out a way to "plot" a vertex so that we can minimize the 
 *  the number of vertices we render. 
 * 
 *  Our constraint is, of course, that we don't get too far off the curve. We 
 *  can measure this subjectively (which is probably a terrible idea, because
 *  we have no idea where to start and the goal) or objectively, using an error 
 *  metric: 
 * 
 *      DONE(!): explore using area as an error metric. Find area of a 3D-"polygon" 
 *          by dividing the polygon into triangles in space and adding up the 
 *          areas. 
 *      TODO: explore Lagrange error / remainder. The Lagrange error is an 
 *          integral. See how this relates to my area. 
 */

const geometries = []
let total_vertices = 0
let total_iterations = 0
let total_time_ms = 0

// TODO: support fallbacks
const worker_pool = []


function getCoreCount() {

  let cores = window.navigator.hardwareConcurrency
  if(!cores) {
      // this makes me angry. it's not worth the effort
      
      const w = window.screen.width * window.devicePixelRatio
      const h = window.screen.height * window.devicePixelRatio
      
      if (w === 2880 && h === 1800) { cores = 8 } // MacBook Pro 15" retina
      else { cores = 4 }
  }

  return cores
}

//const n_workers = Math.max(1, getCoreCount() - 1)
const n_workers = 4

//for(let i = 1; i < n_workers; i++) {
    //worker_pool.push(new WebWorker())
//}
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())
worker_pool.push(new HTTPWorker())


const queue = []
const processed = []


//const queue_item = (worker_info) => ({
    //wrapped_f,
    //args,
    //worker_info
//})
function queue_pluck_one() {
    const available_worker = worker_pool.find(w => !w.is_busy)

    if(available_worker === undefined)
        return

    let job = queue.shift()
    if(job !== undefined) {
        available_worker.is_busy = true
        job(available_worker)
    }
}
function queue_push(f, args) {
    // Promises automatically unnest themselves
    return new Promise((resolve, reject) => {
        const linked_job = worker_info => 
            run_f(f, args)(worker_info)
                .then(x => {
                    processed.push(x)
                    return x
                })
                .then(x => {
                    queue_pluck_one()
                    return x
                })
                .then(resolve)

        queue.push(linked_job)

        queue_pluck_one()
    })
}

const run_f = (f, args) => worker_info => {
    return f.apply(null, [worker_info, ...args])
    
        //the show must go on no matter what.
        .catch(e => console.error(e))
        
        .then(result => {
            worker_info.is_busy = false

            return {
                f,
                args,
                worker_info,
                result
            }
        })
}

function WebWorker() {
    this._internal = new Worker('field-solver-worker.js')
    this.is_busy = false
}
WebWorker.prototype.run = function(args) {
    this._internal.postMessage(...args)

    return new Promise((resolve, reject) => {
        this._internal.onmessage = (event) => {
            resolve(event.data)
        }
    })
}
function HTTPWorker() {
    this._endpoint = location.hostname === "localhost"
        ? "//" + location.hostname + ":9000/generate_field_line_vertices"
        : "//" + location.host + "/.netlify/functions/generate_field_line_vertices"

    this.is_busy = false
}
HTTPWorker.prototype.run = function(args) {
    return axios.get(this._endpoint, {params: args}).then(res => res.data)
}

async function create_line(worker, r_0, r_1, g_0) {
    const data = await worker.run({r_0, r_1, g_0})
            
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
    promises.push(queue_push( create_line, [starting_point[0], starting_point[1], 0]))
})

window.onbeforeunload = function() {
  if(!entered) return "data not entered yet!"
}

/************/

const get_vertices_export = () =>
    JSON.stringify(
        geometries.map(g => Array.from(
            g.attributes.position.array.slice(0, g.drawRange.count))))

//queue_push(create_line, [-110, -1, 0])
//queue_push(create_line, [-99, -10, 0])
//queue_push(create_line, [-100, 5, 0])
//queue_push(create_line, [-100, -5, 0])

let entered = false
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

    //db.replicate.to(remoteCouch)
    entered = true
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
        `Finished all lines. \n` + 
        `   total_vertices=${total_vertices.toExponential()}, \n` +
        `   total_iterations=${total_iterations.toExponential()} \n` +
        `   average time / iteration = ${avg_time_per_iteration_ns} ns \n`
    ) 
})


//console.log('wasm on')
//queue_push(create_line, [-5, 101, 0])

animate()

