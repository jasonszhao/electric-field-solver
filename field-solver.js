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
 * Code by Matt Hobbs
 * released under Creative Commons Attribution International 4.0 (CC BY 4.0)
 * https://nooshu.github.io/lab/2011-05-15-debug-axes-in-three-js/
 **********************************************************/
var debugaxis = function(axisLength){
    //Shorten the vertex function
    function v(x,y,z){
            return new THREE.Vector3(x,y,z)
    }

    //Create axis (point1, point2, colour)
    function createAxis(p1, p2, color){
            var line, lineGeometry = new THREE.Geometry(),
            lineMat = new THREE.LineBasicMaterial({color: color, lineWidth: 1});
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

	//field = find_field(r)

	//if(vec2.len(field) > 10) return;

	//vec2.scale
	//( delta_r
		//, field, -nabla)
	//vec2.add
	//( r
		//, r, delta_r)

	//delta_g = vec2.dot(field, r)
	//g += delta_g


	//geometry.vertices.push(new THREE.Vector3(r[0], g/100, r[1]))
	//geometry.verticesNeedUpdate = true

	window.requestAnimationFrame(animate)
}



//-----------
const small_fast_len2 = a => 
	Math.abs(a[0] + a[1])



const charges = [
	[-100, 0, 10],
	 [100, 0, -10]
	]

charges.forEach(c => {
	const geometry = new THREE.CylinderBufferGeometry( 1, 1, 200, 32 );
	const material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
	const cylinder = new THREE.Mesh( geometry, material );
	cylinder.position.x = c[0]
	cylinder.position.y = c[1]
	scene.add( cylinder );
})



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

//https://threejs.org/docs/index.html#api/geometries/ParametricBufferGeometry

//generate some points
const geometries = []
let total_vertices = 0

function generate_field_line(starting_point, g_0) {
	//const r_0 = [-90, 50]
	//const g_0 = 0
	const nabla = 40
	const resolution = 10

	const iterations = 60000000
	const vertices = new Float32Array(3 * iterations / resolution + 3)
	vertices_i = 0



	const r = starting_point.slice(0, 2)
	let g = g_0

	const delta_r = Float32Array.of(0,0)

	vertices[vertices_i++] = r[0]
	vertices[vertices_i++] = g
	vertices[vertices_i++] = r[1]


	let delta_pos_prev_prev = Float32Array.of(-1,-1,-1)
	let delta_pos_prev = Float32Array.of(1,1,1)
	let tmp

	let i = 0
	for (; i<iterations; i++) {
		const field = find_field(r)

		const mag_field = small_fast_len2(field)
		if(mag_field > 5) break;
		
// TODO: test if this works well for straight lines

/**
 *  TODO: figure out a way to "plot" a vertex so that we can minimize the 
 *  the number of vertices we render. 
 * 
 *  Our constraint is, of course, that we don't get too far off the curve. We 
 *  can measure this subjectively (which is probably a terrible idea, because
 *  we have no idea where to start and the goal) or objectively, using an error 
 *  metric: 
 * 
 *		TODO: explore using area as an error metric. Find area of a 3D-"polygon" 
 *    		by dividing the polygon into triangles in space and adding up the 
 *          areas. 
 *      TODO: explore Lagrange error / remainder. The Lagrange error is an 
 *        	integral. See how this relates to my area. 
 */

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
		delta_pos_prev = delta_pos_prev_prev
		delta_pos_prev_prev = tmp
		
		delta_pos_prev[0] = delta_r[0]
		delta_pos_prev[1] = delta_r[1]
		delta_pos_prev[2] = delta_g

		if(i % resolution === 0) {
			vertices[vertices_i++] = r[0]
			vertices[vertices_i++] = g * 100
			vertices[vertices_i++] = r[1]
			total_vertices++
			
			if(i % (resolution * 10000) === 0) {
				console.log(`pushing (${Math.floor(i/iterations * 100)}%): `, 
				r[0], g * 100, r[1], `field = ${field}`, `mag_field = ${mag_field}`)
			}
		}
	}
	console.log(`Finished with ${i} iterations (proportion of limit: ${(i/iterations).toExponential()})`)

	const material = new THREE.LineBasicMaterial({color: 0x0000ff})
	const geometry = new THREE.BufferGeometry()
	geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) )
	const line = new THREE.Line(geometry, material)
	scene.add(line)
	
	geometry.setDrawRange(0, Math.floor(i / resolution))

	geometries.push(geometry)

}


const starting_points = [] // Array([r[0], r[1], <-1 or 1>])
const n = 12
const distance_from_charge = 5
const center = [-100, 0]

//const starting_angle =  Math.PI * 5 / 6 
//const ending_angle = -Math.PI * 5 / 6

const starting_angle = 0
const ending_angle = Math.PI * 2

for(let i=0; i<n; i++) {
	const angle = starting_angle + i / n * (ending_angle - starting_angle)
	
	if(angle % Math.PI < Number.EPSILON) continue

	starting_points.push([
		center[0] + distance_from_charge * Math.cos(angle),
		center[1] + distance_from_charge * Math.sin(angle),
		1,
	])
}

//this is parallelizable
starting_points.forEach(starting_point => {
	generate_field_line(starting_point, 0)
})
console.log('total_vertices: ' + total_vertices)

//generate_field_line([-110, -10], 0)
//generate_field_line([-99, -10], 0)

//generate_field_line([-190, 500], 0)

animate()
