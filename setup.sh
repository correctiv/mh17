#!/bin/sh
npm install
bower install
cd server/
node convert.js
cd ..
gulp
