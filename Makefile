
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


deploy: deploy-functions

.PHONY: functions
deploy-functions: functions-dist/default/index.js
	gcloud beta functions deploy field_line_vertices --trigger-http --runtime nodejs8 --source functions-dist/default --timeout 540

functions-dist/default/index.js: functions/default/index.js
	webpack


# compile using emcc (or gcc/clang for quick testing iterations)
field-solver-wasm.html: field-solver-wasm.c
	emcc field-solver-wasm.c -o field-solver-wasm.html
field-solver-wasm.js: field-solver-wasm.c
	emcc field-solver-wasm.c -o field-solver-wasm.js

