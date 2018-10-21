cmake_minimum_required(VERSION 3.8)
project(electric_field_solver)

set(CMAKE_CXX_STANDARD 11)

set(SOURCE_FILES
        field-solver-wasm.c)

add_executable(electric_field_solver ${SOURCE_FILES})