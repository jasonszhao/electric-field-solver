#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <tgmath.h>
#include <time.h>

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
//takes an array of vec3* and allocates a contiguous array (Float32Array in JS)
float *array_of_vec3_to_array(int count, vec3 **list) {
    float *result = malloc(3 * count * sizeof(float));
    assert(result != NULL);

    for(int i = 0; i < count; i++) {
        result[3*i    ] = list[count]->x;
        result[3*i + 1] = list[count]->y;
        result[3*i + 2] = list[count]->z;
    }
}
/***********************
 * END JS Interfacing
 ***********************/

vec3 *cross (vec3 *out, vec3 *u, vec3 *v) {
    out->x = u->y * v->z - u->z * v->y;
    out->y = u->z * v->x - u->x * v->z;
    out->z = u->x * v->y - u->y * v->x;

    return out;
}

vec3 *difference (vec3 *out, vec3 *a, vec3 *b) {
    out->x = a->x - b->x;
    out->y = a->y - b->y;
    out->z = a->z - b->z;

    return out;
}

float len (vec3 *a) {
    return sqrt(
        a->x * a->x +
        a->y * a->y +
        a->z * a->z
    );
}

float triangle_area(vec3 *a, vec3 *b, vec3 *c) {
    // area = 1/2 * AB x AC
    vec3 AB;
    vec3 AC;
    vec3 product;

    difference(&AB, b, a);
    difference(&AC, c, a);
    cross(&product, &AB, &AC);

    return len(&product) / 2;
}

vec3 f(float t) {
    return (vec3) {t, t*t*t, t*t};
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


/*************************
 * Begin electric stuff
 *************************/
inline float small_fast_len2(vec3 *u) { return abs(u->x) + abs(u->y); }

vec3 *find_field(vec3 *out, vec3 *u);

void generate_field_line(vec3* starting_point);

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

