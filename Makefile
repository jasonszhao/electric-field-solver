
.PHONY: all
all: dist/field-solver-wasm.js dist/field-solver-wasm

EXPORTED_FUNCTIONS ="[ '_free', '_malloc', \
'_generate_field_line', \
'_set_MAX_VERTICES_PER_LINE', \
'_set_nabla', \
'_set_max_error_area', \
'_set_min_average_resolution', \
'_set_iterations', \
'_set_charges']"

dist/field-solver-wasm.js: field-solver-wasm.c
	emcc -O3 -s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
		-s ASSERTIONS=1 -s MODULARIZE=1 field-solver-wasm.c -o dist/field-solver-wasm.js 

dist/field-solver-wasm: field-solver-wasm.c
	clang -O3 field-solver-wasm.c -o dist/field-solver-wasm

