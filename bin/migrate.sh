#!/bin/bash

SCRIPT_DIR=`dirname ${0}`
cd $SCRIPT_DIR/..

./bin/sqlite3def --file schema.sql ./data/blog.sqlite3
