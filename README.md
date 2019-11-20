# Create an OCaml Action using TypeScript

Use this template to bootstrap the creation of an OCaml action.:rocket:

This template installs the [opam](https://opam.ocaml.org) on Ubuntu Linux,
macOS and Windows (using the
[fdopen](https://fdopen.github.io/opam-repository-mingw/installation/) fork). 

If you are new, there's also a simpler introduction.  See the [Hello World
OCaml Action](https://github.com/avsm/setup-ocaml/tree/hello-world) that uses Dune
and opam to build a simple library.

## Inputs

- `ocaml-version`: the full version of the OCaml compiler (default 4.08.1)

## Example workflow

```
name: Build Hello World executable
on: [push]
jobs:
  run:
    name: Build
    runs-on: ${{ matrix.operating-system }}
    strategy:
      matrix:
        operating-system: [macos-latest, ubuntu-latest, windows-latest]
        ocaml-version: [ '4.09.0', '4.08.1' ]
    steps:
    - uses: actions/checkout@master
    - uses: avsm/setup-ocaml@master
      with:
        ocaml-version: ${{ matrix.ocaml-version }}
    - run: opam pin add hello.dev -n .
    - run: opam depext -yt hello
    - run: opam install -t . --deps-only
    - run: opam exec -- dune build
    - run: opam exec -- dune runtest
```
