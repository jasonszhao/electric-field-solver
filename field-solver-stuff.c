#include <assert.h>
#include <emscripten/emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <tgmath.h>
#include <time.h>

const int N_SIG_FIGS = 6;

const float nabla = 10;
const int min_resolution = 3;
const float max_error_area = 0.25;
const int min_average_resolution = 100;
const int iterations = 6e7;
const float MAX_VERTICES_PER_LINE = 500;

/**
 *  Notes about types:
 *
 *   1) `double` and `float` have no performance difference running
 *      natively on my 64-bit machine. However, we're using single-precision
 *      floats because 24-bits of precision (~7.2 digits in decimals) is more 
 *      than enough for our purposes. I do need to take into account:
 *
 *        a) CPU performance on other architectures, including WebAssembly
 *        b) memory. I plan to pass float arrays down networks and between 
 *           WASM <-> JS. The whole app is based on crunching large sets of
 *           floating-point numbers. Memory usage can almost be halved. Why not?
 *
 *   2) I'm using a struct to store 3-vectors because they're more intuitive to 
 *      use than arrays in C. 
 *
 *        a) You can copy structs, but not arrays. 
 *        b) `.x`, `.y`, `.z` is easier to reason about than worrying about 
 *           pointers and numbers, especially when I already have to deal
 *           with arrays of vec3's. 
 *
 *      JavaScript arrays (we're actually using `TypedArray`s, but the reasoning 
 *      still applies) gives us more abstraction / protection. They're obviously
 *      friendlier than C arrays. Also, JS can access WASM's memory buffer as 
 *      a TypedArray for free, so any vec3 output to JS will have to be 
 *      converted to arrays on the heap. Then our functions can output pointers 
 *      to these arrays. 
 *
 **/


typedef struct {
    float x;
    float y;
    float z;
} vec3;

typedef struct {
    float x;
    float y;
} vec2;

typedef struct {
    int n_vertices;
    vec3 *result;
} generate_field_line_t;

generate_field_line_t generate_field_line(float r_x0, float r_y0, float g_0);
/***********************
 * JS Interfacing 
 ***********************/
float *vec3_to_array(vec3 *u) {
    float *result = malloc(3 * sizeof(float));
    assert(result != NULL);

    result[0] = u->x;
    result[1] = u->y;
    result[2] = u->z;
    return result;
}
//takes an array of vec3 and allocates a contiguous array (Float32Array in JS)
float *array_of_vec3_to_array(int count, vec3 *list) {
    float *result = malloc(3 * count * sizeof(float));
    assert(result != NULL);

    for(int i = 0; i < count; i++) {
        result[3*i    ] = list[count].x;
        result[3*i + 1] = list[count].y;
        result[3*i + 2] = list[count].z;
    }
    return result;
}

EMSCRIPTEN_KEEPALIVE
float *exported_generate_field_line(float r_x0, float r_y0, float g_0) {
    generate_field_line_t internal = generate_field_line(r_x0, r_y0, g_0);
    return array_of_vec3_to_array(internal.n_vertices, internal.result);
}
/***********************
 * END JS Interfacing
 ***********************
 * BEGIN Math functions
 ***********************/

vec3 *cross (vec3 *out, vec3 *u, vec3 *v) {
    out->x = u->y * v->z - u->z * v->y;
    out->y = u->z * v->x - u->x * v->z;
    out->z = u->x * v->y - u->y * v->x;
    return out;
}
vec2 *vec2_add (vec2 *out, vec2 *a, vec2 *b) {
    out->x = a->x + b->x;
    out->y = a->y + b->y;
    return out;
}
vec3 *vec3_add (vec3 *out, vec3 *a, vec3 *b) {
    out->x = a->x + b->x;
    out->y = a->y + b->y;
    out->z = a->z + b->z;
    return out;
}
vec3 *vec3_copy (vec3 *out, vec3 *u) {
    out->x = u->x;
    out->y = u->y;
    out->z = u->z;
    return out;
}
vec3 *vec3_difference (vec3 *out, vec3 *a, vec3 *b) {
    out->x = a->x - b->x;
    out->y = a->y - b->y;
    out->z = a->z - b->z;
    return out;
}
vec2 *vec2_difference (vec2 *out, vec2 *a, vec2 *b) {
    out->x = a->x - b->x;
    out->y = a->y - b->y;
    return out;
}
float vec2_dot (vec2 *a, vec2 *b) {
    return a->x * b->x + a->y * b->y;
}
float vec3_distance (vec3 *a, vec3 *b) {
    return sqrt(
        pow(b->x - a->x, 2) + 
        pow(b->y - a->y, 2) + 
        pow(b->z - a->z, 2) );
}
float vec3_len (vec3 *a) {
    return sqrt(
        a->x * a->x +
        a->y * a->y +
        a->z * a->z);
}
float vec2_len (vec2 *a) {
    return sqrt(
        a->x * a->x +
        a->y * a->y );
}
vec2 *vec2_scale(vec2 *out, vec2 *u, float k) {
    out->x = u->x * k;
    out->y = u->y * k;
    return out;
}
vec3 *vec3_scale(vec3 *out, vec3 *u, float k) {
    out->x = u->x * k;
    out->y = u->y * k;
    out->z = u->z * k;
    return out;
}

float triangle_area(vec3 *a, vec3 *b, vec3 *c) {
    // area = 1/2 * AB x AC
    vec3 AB;
    vec3 AC;
    vec3 product;

    vec3_difference(&AB, b, a);
    vec3_difference(&AC, c, a);
    cross(&product, &AB, &AC);

    return vec3_len(&product) / 2;
}
/********************
 * Electric stuff
 ********************/

// TODO: get this information from JS
const int charges_n = 4;
vec3 charges[4] = {
    {-100, 0, -10},
    {100, 0, -10},
    {0, -100, +10},
    {0, 100, +10}
};

vec2 find_field(vec2 *position) {
    vec2 direction;
    vec2 field_i = {0,0};
    vec2 field_output = {0,0};

	for(int i = 0; i<charges_n; i++) {
		vec2_difference(&direction, position, (vec2*) &charges[i]);
		float distance = vec2_len(&direction);
		vec2_scale(&field_i, &direction, -charges[i].z * pow(distance, -3));
		vec2_add(&field_output, &field_output, &field_i);
	}

	return field_output;
}

/**************************
 * just some testing stuff
 **************************/

vec3 f(float t) {
    return (vec3) { t, t*t*t, t*t };
}

float area(int n, float start, float end) {

    assert(n > 2);

    vec3 points[n];

    for(int i = 0; i<n; i++) {
        float t = start + (end - start) * i / n;
        points[i] = f(t);

        /*printf("f(%f) = [%f, %f, %f]\n", t, points[i].x, points[i].y, points[i].z);*/
    }
    float area = 0;
    for(int i = 0; i<n; i++) {
        vec3 *a = points + i;
        vec3 *b = points + ((i + 1) % n);
        vec3 *c = points + ((i + 2) % n);

        area += triangle_area(a, b, c);
    }

    return area;
}


generate_field_line_t generate_field_line(float r_x0, float r_y0, float g_0) {
    float start_time = (float) clock() / CLOCKS_PER_SEC * 1000;

    vec3 *vertices = malloc(MAX_VERTICES_PER_LINE * sizeof(vec3));
    
    int n_vertices = 0;

    vec2 r = {r_x0, r_y0};
    float g = g_0;
    vec2 delta_r = {0,0};

    vertices[0] = (vec3) {r_x0, g_0, r_y0};
    n_vertices++;
    
	vec3 delta_pos_prev_prev = {-1,-1,-1};
	vec3 delta_pos_prev = {1,1,1};

    int geometry_testing_start_i = 0;
    vec3 geometry_testing_start_vertex = {r_x0, g_0 * 100, r_y0};
    vec3 geometry_testing_prev_vertex;
    vec3 geometry_testing_current_vertex;

    float geometry_testing_error_area = 0;


	int i = 0;
	for (; i<iterations; i++) {
		vec2 field = find_field(&r);

		/*vec2 mag_field = small_fast_len2(field);*/
        float mag_field = vec2_len(&field);
		if(mag_field > 3) break;

		float mag_second_difference = 
            vec3_distance(&delta_pos_prev, &delta_pos_prev_prev) || 1.0;
		float mag_delta_pos_prev = vec3_len(&delta_pos_prev);

		float factor = pow(mag_delta_pos_prev / mag_second_difference, 1/2);

		vec2_scale
			( &delta_r
			, &field, -nabla * factor) ;
		vec2_add
			( &r
			, &r, &delta_r);

		float delta_g = vec2_dot(&field, &delta_r);
		g += delta_g;
		
		
		vec3_copy(&delta_pos_prev_prev, &delta_pos_prev);

		
		delta_pos_prev.x = delta_r.x;
		delta_pos_prev.y = delta_r.y;
		delta_pos_prev.z = delta_g;


        geometry_testing_current_vertex.x = r.x;
        geometry_testing_current_vertex.y = g * 100;
        geometry_testing_current_vertex.z = r.y;

        // aha! this can be done separately from the top! Need to get some
        // actual data on this
		if(i - geometry_testing_start_i > min_resolution) {

            geometry_testing_error_area += triangle_area(
                &geometry_testing_start_vertex,
                &geometry_testing_prev_vertex,
                &geometry_testing_current_vertex);

            if(geometry_testing_error_area > max_error_area) {
                vertices[n_vertices++] = geometry_testing_prev_vertex;

                vec3_copy(&geometry_testing_start_vertex, &geometry_testing_prev_vertex);
                geometry_testing_start_i = i - 1;
                geometry_testing_error_area = 0;

                printf("pushed: %i%%   %.2f %.2f %.2f  field = %.2f %.2f mag_field = %.2f\n",
                    (int) (i/iterations * 100),
                    r.x, 
                    g * 100, 
                    r.y,
                    field.x, 
                    field.y, 
                    mag_field
                );
            }
			
		}
        vec3_copy(&geometry_testing_prev_vertex, &geometry_testing_current_vertex);
	}


    float end_time = (float) clock() / CLOCKS_PER_SEC * 1000;
    float time_ms = end_time - start_time;
    /*last_run_time_ms = time_ms*/

    printf("Finished line w/ %9i iter (rtm=${%e}), ", i, (float) i/iterations);
    printf("%i vert, ", n_vertices);
    printf("(rtm=%e), ", n_vertices / MAX_VERTICES_PER_LINE);
    printf("in %li ms (%e ns / vert).\n", 
            lround(time_ms), time_ms * 10e6 / n_vertices);


    /*last_run_vertices = n_vertices;*/
    /*last_run_iterations = i;*/

    return (generate_field_line_t) 
        {.n_vertices = n_vertices, .result = vertices};
}

/*************************
 * Begin electric stuff
 *************************/
inline float small_fast_len2(vec3 *u) { return fabs(u->x) + fabs(u->y); }

/*vec3 *find_field(vec3 *out, vec3 *u);*/

/*void generate_field_line(vec3* starting_point);*/

/*************************
 * End electric stuff
 *************************/


int main () {
    float start = 0;
    float end = 1;
    int n = 100;

    printf("using float. start=%f, end=%f, n=%i\n", start, end, n);

    int iterations = 100000;
    float starttime = (float) clock() / CLOCKS_PER_SEC;

    /*printf("area: %f\n", area(n, start, end));*/
    for(int i = 0; i < iterations; i++) 
        area(n, start, end);

    float endtime = (float) clock() / CLOCKS_PER_SEC;

    printf("time: %f µs\n", (endtime - starttime) * 1000000 / iterations);

}

