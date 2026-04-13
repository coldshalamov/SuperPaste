@echo off
setlocal
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0src\cli\bin.ts" %*
