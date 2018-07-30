#include <stdio.h>
#include <tgmath.h>
#include <assert.h>
#include <time.h>


typedef struct {
    double x;
    double y;
    double z;
} vec3;

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

double len (vec3 *a) {
    return sqrt(
        a->x * a->x +
        a->y * a->y +
        a->z * a->z
    );
}

double triangle_area(vec3 *a, vec3 *b, vec3 *c) {
    // area = 1/2 * AB x AC
    vec3 AB;
    vec3 AC;
    vec3 product;

    difference(&AB, b, a);
    difference(&AC, c, a);
    cross(&product, &AB, &AC);

    return len(&product) / 2;
}

vec3 f(double t) {
    return (vec3) {t, t*t*t, t*t};
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


/*************************
 * Begin electric stuff
 *************************/
inline float small_fast_len2(vec3 *u) { return abs(u.x) + abs(u.y); }

vec3 *find_field(vec3 *out, vec3 *u);

void generate_field_line(vec3* starting_point);

/*************************
 * End electric stuff
 *************************/


int main () {
    double start = 0;
    double end = 1;
    int n = 100;

    printf("using double. start=%f, end=%f, n=%i\n", start, end, n);

    int iterations = 100000;
    double starttime = (float) clock() / CLOCKS_PER_SEC;

    /*printf("area: %f\n", area(n, start, end));*/
    for(int i = 0; i < iterations; i++) 
        area(n, start, end);

    double endtime = (float) clock() / CLOCKS_PER_SEC;

    printf("time: %f ns\n", (endtime - starttime) * 1000000 / iterations);
}
