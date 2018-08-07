// compile using emcc (or gcc/clang for quick testing iterations)
//
// emcc field-solver-wasm.c -o field-solver-wasm.html
// emcc field-solver-wasm.c -o field-solver-wasm.js

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <tgmath.h>
#include <time.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

/**
 *  Notes about types:
 *
 *   1) Based on my tests, single-precision is not enough for internal 
 *      calculations. I'm exporting float arrays because Three.JS doesn't accept 
 *      Float64Array's, and it also saves a lot of bandwidth.
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
 *      still applies) give us more abstraction and protection, making them
 *      friendlier than C arrays. JS can access WASM's memory buffer as a
 *      TypedArray for free, so any vec3 output to JS will have to be converted
 *      to arrays on the heap. Then our functions can output pointers to these
 *      arrays. 
 *
 *      Since float_vec3 has a memory layout identical to float[3], I can just 
 *      treat one like the other using casts. That way, I can minimize copying/
 *      converting.
 *
 **/


typedef struct {
    double x;
    double y;
    double z;
} vec3;

typedef struct {
    float x;
    float y;
    float z;
} float_vec3;

typedef struct {
    double x;
    double y;
} vec2;

typedef struct {
    int n_vertices;
    float_vec3 *result;
} generate_field_line_t;

/*****************
 * Debugging
 *****************/
void print_vec3(vec3 *u) {
  printf("{x=%f, y=%f, z=%f}\n", u->x, u->y, u->z);
}
void print_vec3_array(int n, vec3 *arr) {
  for(int i = 0; i < n; i++) {
    print_vec3(arr + i);
  }
}

/*************************
 * Configuration
 *************************/
int N_SIG_FIGS = 6;
/*
double nabla = 10;
int min_resolution = 3;
double max_error_area = 0.25;
int min_average_resolution = 100;
long iterations = (long) 6e5;
double MAX_VERTICES_PER_LINE= 5000;
*/

double nabla;
int min_resolution;
double max_error_area;
int min_average_resolution;
long iterations;
double MAX_VERTICES_PER_LINE;

/*intcharges_n 2*/
/*vec3 charges[2] = {*/
        /*{-100, 0, +10},*/
        /*{100, 0, +10}*/
        /*{-100, 0, -10},*/
        /*{100, 0, -10}*/
        
int n_charges;
vec3 *charges = NULL;
/***********************
 * JS Interfacing 
 ***********************/
void set_nabla(double a) {nabla = a;}
void set_max_error_area(double a) {max_error_area = a;}
void set_min_average_resolution (int a) {min_average_resolution = a;}
void set_iterations (long a) {iterations = a;}
void set_MAX_VERTICES_PER_LINE(double a) { MAX_VERTICES_PER_LINE = a; }

void set_charges (int new_n_charges, float *new_charges) {
  free(charges);
  n_charges = new_n_charges;
  charges = (vec3 *) new_charges;

  //printf("setting charges!\n");
  //print_vec3_array(n_charges, charges);
}

float_vec3 *to_float_vec3(float_vec3 *out, vec3 *in) {
  out->x = in->x;
  out->y = in->y;
  out->z = in->z;
  return out;
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
double vec2_dot (vec2 *a, vec2 *b) {
    return a->x * b->x + a->y * b->y;
}
double vec3_distance (vec3 *a, vec3 *b) {
    return sqrt(
        pow(b->x - a->x, 2) + 
        pow(b->y - a->y, 2) + 
        pow(b->z - a->z, 2) );
}
double vec3_len (vec3 *a) {
    return sqrt(
        a->x * a->x +
        a->y * a->y +
        a->z * a->z);
}
double vec2_len (vec2 *a) {
    return sqrt(
        a->x * a->x +
        a->y * a->y );
}
vec2 *vec2_scale(vec2 *out, vec2 *u, double k) {
    out->x = u->x * k;
    out->y = u->y * k;
    return out;
}
vec3 *vec3_scale(vec3 *out, vec3 *u, double k) {
    out->x = u->x * k;
    out->y = u->y * k;
    out->z = u->z * k;
    return out;
}

double triangle_area(vec3 *a, vec3 *b, vec3 *c) {
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

inline double small_fast_len2(vec3 *u) { return fabs(u->x) + fabs(u->y); }


vec2 find_field(vec2 *position) {
    assert(n_charges > 0);
    vec2 direction;
    vec2 field_i = {0,0};
    vec2 field_output = {0,0};

    for(int i = 0; i<n_charges; i++) {
        vec2_difference(&direction, position, (vec2*) &charges[i]);
        double distance = vec2_len(&direction);
        vec2_scale(&field_i, &direction, -charges[i].z * pow(distance, -3));
        vec2_add(&field_output, &field_output, &field_i);
    }

    return field_output;
}


float *generate_field_line(double r_x0, double r_y0, double g_0) {
    double start_time = (double) clock() / CLOCKS_PER_SEC * 1000;

    float *result = malloc(MAX_VERTICES_PER_LINE * 3 * sizeof(float));
    float_vec3 *vertices = (float_vec3*)result + 1;

    int n_vertices = 0;

    vec2 r = {r_x0, r_y0};
    double g = g_0;
    vec2 delta_r = {0,0};

    vertices[0] = (float_vec3) {r_x0, g_0, r_y0};
    n_vertices++;
    
    vec3 delta_pos_prev_prev = {-1,-1,-1};
    vec3 delta_pos_prev = {1,1,1};

    int geometry_testing_start_i = 0;
    vec3 geometry_testing_start_vertex = {r_x0, g_0 * 100, r_y0};
    vec3 geometry_testing_prev_vertex;
    vec3 geometry_testing_current_vertex;

    double geometry_testing_error_area = 0;


    int i = 0;
    for (; i<iterations; i++) {
        vec2 field = find_field(&r);

        /*vec2 mag_field = small_fast_len2(field);*/
        double mag_field = vec2_len(&field);
        if(mag_field > 0.5) {
          if(i > geometry_testing_start_i) {
            to_float_vec3(&vertices[n_vertices++], &geometry_testing_current_vertex);
          }
          break;
        }

        double mag_second_difference = 
            vec3_distance(&delta_pos_prev, &delta_pos_prev_prev) || 1.0;
        double mag_delta_pos_prev = vec3_len(&delta_pos_prev);

        double factor = pow(mag_delta_pos_prev / mag_second_difference, 1/2);

        vec2_scale
            ( &delta_r
            , &field, -nabla * factor) ;
        vec2_add
            ( &r
            , &r, &delta_r);

        double delta_g = vec2_dot(&field, &delta_r);
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
                to_float_vec3(&vertices[n_vertices++], &geometry_testing_prev_vertex);

                vec3_copy(&geometry_testing_start_vertex, &geometry_testing_prev_vertex);
                geometry_testing_start_i = i - 1;
                geometry_testing_error_area = 0;

                
                /*printf("pushed: %i%%  %6.2f %6.2f %7.2f  field = %7.4f %7.4f mag_field = %.4f\n",*/
                       /*(int) (i/iterations * 100),*/
                       /*geometry_testing_prev_vertex.x,*/
                       /*geometry_testing_prev_vertex.y,*/
                       /*geometry_testing_prev_vertex.z,*/
                    /*field.x,*/
                    /*field.y,*/
                    /*mag_field*/
                /*);*/
            }
        }
        vec3_copy(&geometry_testing_prev_vertex, &geometry_testing_current_vertex);
    }

    double end_time = (double) clock() / CLOCKS_PER_SEC * 1000;
    double time_ms = end_time - start_time;

    printf("c Finished line w/ %9i iter (rtm=${%e}), ", i, (double) i/iterations);
    printf("%4i vert, ", n_vertices);
    printf("(rtm=%e), ", n_vertices / MAX_VERTICES_PER_LINE);
    printf("in %li ms (%e ns / vert).\n", 
            lround(time_ms), time_ms * 10e6 / n_vertices);


    result[0] = n_vertices;
    result[1] = i;
    result[2] = time_ms;

    return realloc(result, 3 * sizeof(float) * (n_vertices + 1));

}


/*************************
 * End electric stuff
 *************************/

/*********************************
 * Extremely Incomplete Test code
 *********************************/

vec3 f(double t) {
    return (vec3) { t, t*t*t, t*t };
}

double area(int n, double start, double end) {

    assert(n > 2);

    vec3 points[n];

    for(int i = 0; i<n; i++) {
        double t = start + (end - start) * i / n;
        points[i] = f(t);

        /*printf("f(%f) = [%f, %f, %f]\n", t, points[i].x, points[i].y, points[i].z);*/
    }
    double area = 0;
    for(int i = 0; i<n; i++) {
        vec3 *a = points + i;
        vec3 *b = points + ((i + 1) % n);
        vec3 *c = points + ((i + 2) % n);

        area += triangle_area(a, b, c);
    }

    return area;
}
/*****************
 * End Test Code
 *****************/

int main () {
    /*charges = malloc(4 * sizeof(vec3)); {*/
      /*(vec3) {-100, 0, -10},*/
      /*(vec3) {100, 0, -10},*/
      /*(vec3) {0, -100, +10},*/
      /*(vec3) {0, 100, +10}*/
    /*};*/
    /*double start = 0;*/
    /*double end = 1;*/
    /*int n = 100;*/

    /*printf("using double. start=%f, end=%f, n=%i\n", start, end, n);*/

    /*int iterations = 100000;*/
    /*double starttime = (double) clock() / CLOCKS_PER_SEC;*/

    /*[>printf("area: %f\n", area(n, start, end));<]*/
    /*for(int i = 0; i < iterations; i++) */
        /*area(n, start, end);*/

    /*double endtime = (double) clock() / CLOCKS_PER_SEC;*/

    /*printf("time: %f µs\n", (endtime - starttime) * 1000000 / iterations);*/

    float *ptr = generate_field_line(-100, -5, 0);
    free(ptr);
    ptr = NULL;

}
