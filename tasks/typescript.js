///<reference path="../typings/q/Q.d.ts" />
var GruntTs;
(function (GruntTs) {
    (function (util) {
        var Q = require('q');

        function isStr(val) {
            return Object.prototype.toString.call(val) === "[object String]";
        }
        util.isStr = isStr;

        function isBool(val) {
            return Object.prototype.toString.call(val) === "[object Boolean]";
        }
        util.isBool = isBool;

        function isArray(val) {
            return Object.prototype.toString.call(val) === "[object Array]";
        }
        util.isArray = isArray;

        function isUndef(val) {
            return typeof val === "undefined";
        }
        util.isUndef = isUndef;

        function asyncEach(items, callback) {
            return Q.promise(function (resolve, reject, notify) {
                var length = items.length, exec = function (i) {
                    if (length <= i) {
                        resolve(true);
                        return;
                    }
                    var item = items[i];
                    callback(item, i, function () {
                        i = i + 1;
                        exec(i);
                    });
                };
                exec(0);
            });
        }
        util.asyncEach = asyncEach;
    })(GruntTs.util || (GruntTs.util = {}));
    var util = GruntTs.util;
})(GruntTs || (GruntTs = {}));
///<reference path="../typings/gruntjs/gruntjs.d.ts" />
///<reference path="../typings/node/node.d.ts" />
///<reference path="../typings/typescript/typescript.d.ts" />
///<reference path="util.ts" />
var GruntTs;
(function (GruntTs) {
    var _fs = require('fs');
    var _path = require('path');
    var _os = require('os');

    function writeError(str) {
        console.log('>> '.red + str.trim().replace(/\n/g, '\n>> '.red));
    }
    function writeInfo(str) {
        console.log('>> '.cyan + str.trim().replace(/\n/g, '\n>> '.cyan));
    }

    function normalizePath(path) {
        //if(Object.prototype.toString.call(path) === "[object String]"){
        if (GruntTs.util.isStr(path)) {
            return path.replace(/\\/g, "/");
        }
        return path;
    }

    var _currentPath = normalizePath(_path.resolve("."));

    function currentPath() {
        return _currentPath;
    }

    function readFile(file, codepage) {
        if (codepage !== null) {
            throw new Error(TypeScript.getDiagnosticMessage(TypeScript.DiagnosticCode.codepage_option_not_supported_on_current_platform, null));
        }

        var buffer = _fs.readFileSync(file);
        switch (buffer[0]) {
            case 0xFE:
                if (buffer[1] === 0xFF) {
                    // utf16-be. Reading the buffer as big endian is not supported, so convert it to
                    // Little Endian first
                    var i = 0;
                    while ((i + 1) < buffer.length) {
                        var temp = buffer[i];
                        buffer[i] = buffer[i + 1];
                        buffer[i + 1] = temp;
                        i += 2;
                    }
                    return new TypeScript.FileInformation(buffer.toString("ucs2", 2), 2 /* Utf16BigEndian */);
                }
                break;
            case 0xFF:
                if (buffer[1] === 0xFE) {
                    // utf16-le
                    return new TypeScript.FileInformation(buffer.toString("ucs2", 2), 3 /* Utf16LittleEndian */);
                }
                break;
            case 0xEF:
                if (buffer[1] === 0xBB) {
                    // utf-8
                    return new TypeScript.FileInformation(buffer.toString("utf8", 3), 1 /* Utf8 */);
                }
        }

        // Default behaviour
        return new TypeScript.FileInformation(buffer.toString("utf8", 0), 0 /* None */);
    }

    function writeFile(path, contents, writeByteOrderMark) {
        function mkdirRecursiveSync(path) {
            var stats = _fs.statSync(path);
            if (stats.isFile()) {
                throw "\"" + path + "\" exists but isn't a directory.";
            } else if (stats.isDirectory()) {
                return;
            } else {
                mkdirRecursiveSync(_path.dirname(path));
                _fs.mkdirSync(path, 509);
            }
        }
        mkdirRecursiveSync(_path.dirname(path));

        if (writeByteOrderMark) {
            contents = '\uFEFF' + contents;
        }

        var chunkLength = 4 * 1024;
        var fileDescriptor = _fs.openSync(path, "w");
        try  {
            for (var index = 0; index < contents.length; index += chunkLength) {
                var buffer = new Buffer(contents.substr(index, chunkLength), "utf8");

                _fs.writeSync(fileDescriptor, buffer, 0, buffer.length, null);
            }
        } finally {
            _fs.closeSync(fileDescriptor);
        }
    }

    var GruntIO = (function () {
        function GruntIO(grunt) {
            this.grunt = grunt;
            this.stderr = {
                Write: function (str) {
                    return writeError(str);
                },
                WriteLine: function (str) {
                    return writeError(str);
                },
                Close: function () {
                }
            };
            this.stdout = {
                Write: function (str) {
                    return writeInfo(str);
                },
                WriteLine: function (str) {
                    return writeInfo(str);
                },
                Close: function () {
                }
            };
            this.arguments = process.argv.slice(2);
            //original
            this.newLine = _os.EOL;
        }
        GruntIO.prototype.readFile = function (file, codepage) {
            var result;
            try  {
                this.grunt.verbose.write("Reading " + file + "...");
                result = readFile(file, codepage);
                this.grunt.verbose.writeln("OK".green);
                return result;
            } catch (e) {
                this.grunt.verbose.writeln("");
                this.grunt.verbose.fail("Can't read file. " + e.message);
                throw e;
            }
        };

        GruntIO.prototype.writeFile = function (path, contents, writeByteOrderMark) {
            try  {
                this.grunt.verbose.write("Writing " + path + "...");
                writeFile(path, contents, writeByteOrderMark);
                this.grunt.verbose.writeln("OK".green);
            } catch (e) {
                this.grunt.verbose.writeln("");
                this.grunt.verbose.fail("Can't write file. " + e.message);
                throw e;
            }
        };

        GruntIO.prototype.fileExists = function (path) {
            return _fs.existsSync(path);
        };

        GruntIO.prototype.createDirectory = function (path) {
            if (!this.directoryExists(path)) {
                _fs.mkdirSync(path);
            }
        };

        GruntIO.prototype.directoryExists = function (path) {
            return _fs.existsSync(path) && _fs.statSync(path).isDirectory();
        };

        GruntIO.prototype.resolvePath = function (path) {
            return _path.resolve(path);
        };

        GruntIO.prototype.dirName = function (path) {
            var dirPath = _path.dirname(path);

            // Node will just continue to repeat the root path, rather than return null
            if (dirPath === path) {
                dirPath = null;
            }

            return dirPath;
        };

        //original method
        GruntIO.prototype.currentPath = function () {
            return currentPath();
        };

        //original method
        GruntIO.prototype.combine = function (left, right) {
            return normalizePath(_path.join(left, right));
        };

        //original
        GruntIO.prototype.relativePath = function (from, to) {
            return normalizePath(_path.relative(from, to));
        };

        //original
        GruntIO.prototype.resolveMulti = function () {
            var paths = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                paths[_i] = arguments[_i + 0];
            }
            return normalizePath(_path.resolve.apply(_path, paths));
        };

        //original
        GruntIO.prototype.writeWarn = function (message) {
            this.grunt.log.writeln(message.yellow);
        };

        GruntIO.prototype.normalizePath = function (path) {
            return normalizePath(path);
        };

        GruntIO.prototype.getLastMod = function (path) {
            return _fs.statSync(path).mtime;
        };
        return GruntIO;
    })();
    GruntTs.GruntIO = GruntIO;
})(GruntTs || (GruntTs = {}));
///<reference path="../typings/gruntjs/gruntjs.d.ts" />
///<reference path="../typings/node/node.d.ts" />
///<reference path="../typings/typescript/typescript.d.ts" />
///<reference path="io.ts" />
///<reference path="util.ts" />
var GruntTs;
(function (GruntTs) {
    var _path = require("path"), _fs = require("fs");

    function prepareNewLine(optVal) {
        var val;
        if (optVal) {
            val = optVal.toString().toUpperCase();
            return val === "CRLF" ? 0 /* crLf */ : val === "LF" ? 1 /* lf */ : 2 /* auto */;
        }
        return 2 /* auto */;
    }

    function prepareIndentStep(optVal) {
        if (Object.prototype.toString.call(optVal) === "[object Number]" && optVal > -1) {
            return optVal;
        }
        return -1;
    }

    function prepareBasePath(opt, io) {
        var optVal = "";
        if (GruntTs.util.isStr(opt.base_path)) {
            io.writeWarn("The 'base_path' option will be obsoleted. Please use the 'basePath'.");
            optVal = opt.base_path;
        }
        if (GruntTs.util.isStr(opt.basePath)) {
            optVal = opt.basePath;
        }

        if (!optVal) {
            return undefined;
        }
        optVal = io.normalizePath(optVal);
        if (optVal.lastIndexOf("/") !== optVal.length - 1) {
            optVal = optVal + "/";
        }

        //TODO: ほんまにいるかチェック
        return io.normalizePath(optVal);
    }

    function prepareSourceMap(opt, io) {
        var optVal = false;
        if (opt.sourcemap) {
            io.writeWarn("The 'sourcemap' option will be obsoleted. Please use the 'sourceMap'. (different casing)");
            optVal = !!opt.sourcemap;
        }
        if (opt.sourceMap) {
            optVal = !!opt.sourceMap;
        }
        return optVal;
    }

    function prepareNoLib(opt, io) {
        var optVal = false;
        if (opt.nolib) {
            io.writeWarn("The 'nolib' option will be obsoleted. Please use the 'noLib'. (different casing)");
            optVal = !!opt.nolib;
        }
        if (opt.noLib) {
            optVal = !!opt.noLib;
        }
        return optVal;
    }

    function checkIgnoreTypeCheck(opt, io) {
        if (!GruntTs.util.isUndef(opt.ignoreTypeCheck)) {
            io.writeWarn("The 'ignoreTypeCheck' option removed. Please use the 'ignoreError'.");
        }
    }

    function prepareIgnoreError(optVal) {
        var val = false;
        if (!GruntTs.util.isUndef(optVal)) {
            val = !!optVal;
        }
        return val;
    }

    function prepareNoResolve(optVal) {
        var val = false;
        if (!GruntTs.util.isUndef(optVal)) {
            val = !!optVal;
        }
        return val;
    }

    function prepareTarget(optVal) {
        var val = undefined;
        if (optVal.target) {
            var temp = (optVal.target + "").toLowerCase();
            if (temp === 'es3') {
                val = 0 /* EcmaScript3 */;
            } else if (temp == 'es5') {
                val = 1 /* EcmaScript5 */;
            }
        }
        return val;
    }

    function prepareModule(optVal) {
        var val = undefined;
        if (optVal.module) {
            var temp = (optVal.module + "").toLowerCase();
            if (temp === 'commonjs' || temp === 'node') {
                val = 1 /* Synchronous */;
            } else if (temp === 'amd') {
                val = 2 /* Asynchronous */;
            }
        }
        return val;
    }

    function prepareWatch(optVal, files, io) {
        var after = [], before = [], getDirNames = function (files) {
            return files.map(function (file) {
                if (_fs.existsSync(file)) {
                    if (_fs.statSync(file).isDirectory()) {
                        return file;
                    }
                } else {
                    if (!_path.extname(file)) {
                        return file;
                    }
                }
                return io.normalizePath(io.resolvePath(_path.dirname(file)));
            });
        }, extractPath = function (files) {
            var dirNames = getDirNames(files);
            return dirNames.reduce(function (prev, curr) {
                if (!prev) {
                    return curr;
                }
                var left = io.normalizePath(_path.relative(prev, curr)), right = io.normalizePath(_path.relative(curr, prev)), match = left.match(/^(\.\.(\/)?)+/);
                if (match) {
                    return io.normalizePath(_path.resolve(prev, match[0]));
                }
                match = right.match(/^(\.\.\/)+/);
                if (match) {
                    return io.normalizePath(_path.resolve(curr, match[0]));
                }
                return prev;
            }, undefined);
        };
        if (!optVal) {
            return undefined;
        }
        if (GruntTs.util.isStr(optVal)) {
            return {
                path: (optVal + ""),
                after: [],
                before: [],
                atBegin: false
            };
        }
        if (GruntTs.util.isBool(optVal) && !!optVal) {
            return {
                path: extractPath(files),
                after: [],
                before: [],
                atBegin: false
            };
        }
        if (!optVal.path) {
            optVal.path = extractPath(files);
        }
        if (optVal.after && !GruntTs.util.isArray(optVal.after)) {
            after.push(optVal.after);
        } else if (GruntTs.util.isArray(optVal.after)) {
            after = optVal.after;
        }
        if (optVal.before && !GruntTs.util.isArray(optVal.before)) {
            before.push(optVal.before);
        } else if (GruntTs.util.isArray(optVal.before)) {
            before = optVal.before;
        }

        return {
            path: optVal.path,
            after: after,
            before: before,
            atBegin: !!optVal.atBegin
        };
    }

    (function (NewLine) {
        NewLine[NewLine["crLf"] = 0] = "crLf";
        NewLine[NewLine["lf"] = 1] = "lf";
        NewLine[NewLine["auto"] = 2] = "auto";
    })(GruntTs.NewLine || (GruntTs.NewLine = {}));
    var NewLine = GruntTs.NewLine;

    var Opts = (function () {
        function Opts(_source, grunt, gruntFile, _io) {
            this._source = _source;
            this.grunt = grunt;
            this.gruntFile = gruntFile;
            this._io = _io;
            this._source = _source || {};
            this.destinationPath = _io.normalizePath(gruntFile.dest);

            this.newLine = prepareNewLine(this._source.newLine);
            this.indentStep = prepareIndentStep(this._source.indentStep);
            this.useTabIndent = !!this._source.useTabIndent;
            this.basePath = prepareBasePath(this._source, this._io);
            this.outputOne = !!this.destinationPath && _path.extname(this.destinationPath) === ".js";
            this.noResolve = prepareNoResolve(this._source.noResolve);
            this.sourceMap = prepareSourceMap(this._source, this._io);
            this.noLib = prepareNoLib(this._source, this._io);
            this.declaration = !!this._source.declaration;
            this.removeComments = !this._source.comments;
            this.ignoreError = prepareIgnoreError(this._source.ignoreError);
            this.langTarget = prepareTarget(this._source);
            this.moduleTarget = prepareModule(this._source);
            this.noImplicitAny = typeof this._source.noImplicitAny === "undefined" ? undefined : !!this._source.noImplicitAny;
            this.disallowAsi = typeof this._source.disallowAsi === "undefined" ? undefined : !!this._source.disallowAsi;

            //experimental
            this.watch = prepareWatch(this._source.watch || this._source._watch, this.expandedFiles(), _io);

            checkIgnoreTypeCheck(this._source, this._io);
        }
        Opts.prototype.expandedFiles = function () {
            return this.grunt.file.expand(this.gruntFile.orig.src);
        };

        Opts.prototype.createCompilationSettings = function () {
            var settings = new TypeScript.CompilationSettings(), dest = this.destinationPath, ioHost = this._io;

            if (this.outputOne) {
                settings.outFileOption = _path.resolve(ioHost.currentPath(), dest);
            }

            settings.mapSourceFiles = this.sourceMap;
            settings.generateDeclarationFiles = this.declaration;
            settings.removeComments = this.removeComments;

            if (!GruntTs.util.isUndef(this.langTarget)) {
                settings.codeGenTarget = this.langTarget;
            }
            if (!GruntTs.util.isUndef(this.moduleTarget)) {
                settings.moduleGenTarget = this.moduleTarget;
            }
            if (!GruntTs.util.isUndef(this.noImplicitAny)) {
                settings.noImplicitAny = this.noImplicitAny;
            }
            if (!GruntTs.util.isUndef(this.disallowAsi)) {
                settings.allowAutomaticSemicolonInsertion = this.disallowAsi;
            }

            settings.noLib = this.noLib;
            settings.noResolve = this.noResolve;

            return TypeScript.ImmutableCompilationSettings.fromCompilationSettings(settings);
        };
        return Opts;
    })();
    GruntTs.Opts = Opts;
})(GruntTs || (GruntTs = {}));
///<reference path="../typings/gruntjs/gruntjs.d.ts" />
///<reference path="../typings/q/Q.d.ts" />
///<reference path="util.ts" />
var GruntTs;
(function (GruntTs) {
    function runTask(grunt, tasks) {
        return GruntTs.util.asyncEach(tasks, function (task, index, next) {
            grunt.util.spawn({
                grunt: true,
                args: [task].concat(grunt.option.flags()),
                opts: { stdio: 'inherit' }
            }, function (err, result, code) {
                next();
            });
        });
    }
    GruntTs.runTask = runTask;
})(GruntTs || (GruntTs = {}));
///<reference path="../typings/gruntjs/gruntjs.d.ts" />
///<reference path="../typings/node/node.d.ts" />
///<reference path="../typings/typescript/typescript.d.ts" />
///<reference path="../typings/q/Q.d.ts" />
///<reference path="./io.ts" />
///<reference path="./opts.ts" />
///<reference path="./runner.ts" />
var GruntTs;
(function (GruntTs) {
    var Q = require('q');

    var SourceFile = (function () {
        //TODO: Extend(append lastMod, append Property)
        function SourceFile(scriptSnapshot, byteOrderMark, lastMod) {
            if (typeof lastMod === "undefined") { lastMod = new Date(0); }
            this.scriptSnapshot = scriptSnapshot;
            this.byteOrderMark = byteOrderMark;
            this.lastMod = lastMod;
        }
        return SourceFile;
    })();

    var Task = (function () {
        function Task(grunt, tscBinPath, ioHost) {
            this.grunt = grunt;
            this.tscBinPath = tscBinPath;
            this.ioHost = ioHost;
            this.fileNameToSourceFile = new TypeScript.StringHashTable();
            this.hasErrors = false;
            this.resolvedFiles = [];
            this.logger = null;
            this.outputFiles = [];
            this.fileExistsCache = TypeScript.createIntrinsicsObject();
            this.resolvePathCache = TypeScript.createIntrinsicsObject();
        }
        Task.prototype.start = function (options) {
            var _this = this;
            this.options = options;
            this.compilationSettings = options.createCompilationSettings();
            this.logger = new TypeScript.NullLogger();

            return Q.promise(function (resolve, reject, notify) {
                if (!_this.options.watch) {
                    try  {
                        _this.exec();
                        resolve(true);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    _this.startWatch(resolve, reject);
                }
            });
        };

        Task.prototype.exec = function () {
            var start = Date.now();

            this.inputFiles = this.options.expandedFiles();
            this.outputFiles = [];
            this.resolve();
            this.compile();

            this.writeResult(Date.now() - start);
        };

        Task.prototype.startWatch = function (resolve, reject) {
            var _this = this;
            if (!this.options.watch) {
                resolve(true);
                return;
            }
            var watchPath = this.ioHost.resolvePath(this.options.watch.path), chokidar = require("chokidar"), watcher, targetPaths = {}, registerEvents = function () {
                watcher = chokidar.watch(watchPath, { ignoreInitial: true, persistent: true });
                watcher.on("add", function (path) {
                    handleEvent(path, "Added");
                }).on("change", function (path) {
                    handleEvent(path, "Changed");
                }).on("unlink", function (path) {
                    handleEvent(path, "Unlinked");
                }).on("error", function (error) {
                    _this.ioHost.stdout.WriteLine("Error".red + ": " + error);
                });
            }, timeoutId, executeBuild = function () {
                return GruntTs.runTask(_this.grunt, _this.options.watch.before).then(function () {
                    _this.exec();
                    return GruntTs.runTask(_this.grunt, _this.options.watch.after);
                });
            }, handleEvent = function (path, eventName) {
                path = _this.ioHost.normalizePath(path);
                if (targetPaths[path]) {
                    targetPaths[path] = eventName;
                    return;
                }
                targetPaths[path] = eventName;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                timeoutId = setTimeout(function () {
                    var keys = Object.keys(targetPaths).filter(function (key) {
                        var result = !!/\.ts$/.test(key), eventName = targetPaths[key];
                        if (result) {
                            _this.ioHost.stdout.WriteLine(targetPaths[key].cyan + " " + key);
                            _this.fileNameToSourceFile.remove(key);
                            if (eventName === "Unlinked" && _this.compiler) {
                                _this.compiler.removeFile(key);
                            }
                        }
                        return result;
                    });
                    targetPaths = {};
                    if (!keys.length)
                        return;
                    executeBuild().fin(function () {
                        _this.writeWatchingMessage(watchPath);
                        timeoutId = 0;
                    });
                }, 300);
            };

            if (this.options.watch.atBegin) {
                executeBuild().fin(function () {
                    _this.writeWatchingMessage(watchPath);
                    registerEvents();
                });
            } else {
                this.writeWatchingMessage(watchPath);
                registerEvents();
            }
        };

        Task.prototype.writeWatchingMessage = function (watchPath) {
            //TODO: grunt mesod
            console.log("");
            console.log("Watching directory.... " + watchPath);
        };

        Task.prototype.resolve = function () {
            var _this = this;
            var resolvedFiles = [];
            var includeDefaultLibrary = !this.compilationSettings.noLib();

            if (!this.options.noResolve) {
                var resolutionResults = TypeScript.ReferenceResolver.resolve(this.inputFiles, this, this.compilationSettings.useCaseSensitiveFileResolution());
                resolvedFiles = resolutionResults.resolvedFiles;

                includeDefaultLibrary = !this.compilationSettings.noLib() && !resolutionResults.seenNoDefaultLibTag;

                resolutionResults.diagnostics.forEach(function (d) {
                    return _this.addDiagnostic(d);
                });
            } else {
                for (var i = 0, n = this.inputFiles.length; i < n; i++) {
                    var inputFile = this.inputFiles[i];
                    var referencedFiles = [];
                    var importedFiles = [];

                    // If declaration files are going to be emitted, preprocess the file contents and add in referenced files as well
                    if (this.compilationSettings.generateDeclarationFiles()) {
                        var references = TypeScript.getReferencedFiles(inputFile, this.getScriptSnapshot(inputFile));
                        for (var j = 0; j < references.length; j++) {
                            referencedFiles.push(references[j].path);
                        }

                        inputFile = this.resolvePath(inputFile);
                    }

                    resolvedFiles.push({
                        path: inputFile,
                        referencedFiles: referencedFiles,
                        importedFiles: importedFiles
                    });
                }
            }

            if (includeDefaultLibrary) {
                var libraryResolvedFile = {
                    path: this.ioHost.combine(this.tscBinPath, "lib.d.ts"),
                    referencedFiles: [],
                    importedFiles: []
                };

                // Prepend the library to the resolved list
                resolvedFiles = [libraryResolvedFile].concat(resolvedFiles);
            }

            this.resolvedFiles = resolvedFiles;
        };

        Task.prototype.compile = function () {
            var _this = this;
            if (!this.compiler) {
                var g = require("./modules/compiler");

                //var compiler = new TypeScript.TypeScriptCompiler(this.logger, this.compilationSettings);
                this.compiler = new g.Compiler(this.logger, this.compilationSettings);
            }

            var emitTargets = [];

            this.resolvedFiles.forEach(function (resolvedFile) {
                var sourceFile = _this.getSourceFile(resolvedFile.path), lastMod = _this.ioHost.getLastMod(resolvedFile.path), isEmitTarget = lastMod > sourceFile.lastMod;

                //TODO: change
                //if(lastMod > sourceFile.lastMod){
                if (isEmitTarget) {
                    emitTargets.push(resolvedFile.path);
                    sourceFile.lastMod = lastMod;
                }
                if (!_this.compiler.getDocument(resolvedFile.path)) {
                    _this.compiler.addFile(resolvedFile.path, sourceFile.scriptSnapshot, sourceFile.byteOrderMark, /*version:*/ 0, false, resolvedFile.referencedFiles);
                } else {
                    if (isEmitTarget) {
                        _this.compiler.updateFile(resolvedFile.path, sourceFile.scriptSnapshot, /*version*/ 0, false, null);
                    }
                }
            });
            var ignoreError = this.options.ignoreError, hasOutputFile = false;

            for (var it = this.compiler.compileEmitTargets(emitTargets, this.ioHost.combine(this.tscBinPath, "lib.d.ts"), function (path) {
                return _this.resolvePath(path);
            }); it.moveNext();) {
                //for (var it = compiler.compile((path: string) => this.resolvePath(path)); it.moveNext();) {
                var result = it.current(), hasError = false;

                result.diagnostics.forEach(function (d) {
                    var info = d.info();
                    if (info.category === 1 /* Error */) {
                        hasError = true;
                    }
                    _this.addDiagnostic(d);
                });
                if (hasError && !ignoreError) {
                    throw new Error();
                }

                hasOutputFile = !!result.outputFiles.length || hasOutputFile;
                if (!this.tryWriteOutputFiles(result.outputFiles)) {
                    throw new Error();
                }
            }
            if (hasError && !hasOutputFile) {
                throw new Error();
            }
        };

        Task.prototype.writeResult = function (ms) {
            var result = { js: [], m: [], d: [], other: [] }, resultMessage, pluralizeFile = function (n) {
                return (n + " file") + ((n === 1) ? "" : "s");
            };
            this.outputFiles.forEach(function (item) {
                if (/\.js$/.test(item))
                    result.js.push(item);
                else if (/\.js\.map$/.test(item))
                    result.m.push(item);
                else if (/\.d\.ts$/.test(item))
                    result.d.push(item);
                else
                    result.other.push(item);
            });

            resultMessage = "js: " + pluralizeFile(result.js.length) + ", map: " + pluralizeFile(result.m.length) + ", declaration: " + pluralizeFile(result.d.length) + " (" + ms + "ms)";
            if (this.options.outputOne) {
                if (result.js.length > 0) {
                    this.grunt.log.writeln("File " + (result.js[0])["cyan"] + " created.");
                }
                this.grunt.log.writeln(resultMessage);
            } else {
                this.grunt.log.writeln(pluralizeFile(this.outputFiles.length)["cyan"] + " created. " + resultMessage);
            }
        };

        Task.prototype.getScriptSnapshot = function (fileName) {
            return this.getSourceFile(fileName).scriptSnapshot;
        };

        Task.prototype.getSourceFile = function (fileName) {
            var sourceFile = this.fileNameToSourceFile.lookup(fileName);

            if (!sourceFile) {
                // Attempt to read the file
                var fileInformation;

                try  {
                    fileInformation = this.ioHost.readFile(fileName, this.compilationSettings.codepage());
                } catch (e) {
                    fileInformation = new TypeScript.FileInformation("", 0 /* None */);
                }

                var snapshot = TypeScript.ScriptSnapshot.fromString(fileInformation.contents);
                sourceFile = new SourceFile(snapshot, fileInformation.byteOrderMark);
                this.fileNameToSourceFile.add(fileName, sourceFile);
            }

            return sourceFile;
        };

        Task.prototype.resolveRelativePath = function (path, directory) {
            var unQuotedPath = TypeScript.stripStartAndEndQuotes(path);
            var normalizedPath;

            if (TypeScript.isRooted(unQuotedPath) || !directory) {
                normalizedPath = unQuotedPath;
            } else {
                normalizedPath = this.ioHost.combine(directory, unQuotedPath);
            }
            normalizedPath = this.resolvePath(normalizedPath);
            normalizedPath = TypeScript.switchToForwardSlashes(normalizedPath);
            return normalizedPath;
        };

        Task.prototype.fileExists = function (path) {
            var exists = this.fileExistsCache[path];
            if (exists === undefined) {
                exists = this.ioHost.fileExists(path);
                this.fileExistsCache[path] = exists;
            }
            return exists;
        };

        Task.prototype.getParentDirectory = function (path) {
            return this.ioHost.dirName(path);
        };

        Task.prototype.addDiagnostic = function (diagnostic) {
            var diagnosticInfo = diagnostic.info();
            if (diagnosticInfo.category === 1 /* Error */) {
                this.hasErrors = true;
            }

            if (diagnostic.fileName()) {
                this.ioHost.stderr.Write(diagnostic.fileName() + "(" + (diagnostic.line() + 1) + "," + (diagnostic.character() + 1) + "): ");
            }

            this.ioHost.stderr.WriteLine(diagnostic.message());
        };

        Task.prototype.tryWriteOutputFiles = function (outputFiles) {
            for (var i = 0, n = outputFiles.length; i < n; i++) {
                var outputFile = outputFiles[i];

                try  {
                    this.writeFile(outputFile.name, outputFile.text, outputFile.writeByteOrderMark);
                } catch (e) {
                    this.addDiagnostic(new TypeScript.Diagnostic(outputFile.name, null, 0, 0, TypeScript.DiagnosticCode.Emit_Error_0, [e.message]));
                    return false;
                }
            }

            return true;
        };

        Task.prototype.writeFile = function (fileName, contents, writeByteOrderMark) {
            var preparedFileName = this.prepareFileName(fileName);
            var path = this.ioHost.resolvePath(preparedFileName);
            var dirName = this.ioHost.dirName(path);
            this.createDirectoryStructure(dirName);

            contents = this.prepareSourcePath(fileName, preparedFileName, contents);

            this.ioHost.writeFile(path, contents, writeByteOrderMark);

            this.outputFiles.push(path);
        };

        Task.prototype.prepareFileName = function (fileName) {
            var newFileName = fileName, basePath = this.options.basePath;

            if (this.options.outputOne) {
                return newFileName;
            }
            if (!this.options.destinationPath) {
                return newFileName;
            }

            var currentPath = this.ioHost.currentPath(), relativePath = this.ioHost.relativePath(currentPath, fileName);

            if (basePath) {
                if (relativePath.substr(0, basePath.length) !== basePath) {
                    throw new Error(fileName + " is not started base_path");
                }
                relativePath = relativePath.substr(basePath.length);
            }

            return this.ioHost.resolveMulti(currentPath, this.options.destinationPath, relativePath);
        };

        Task.prototype.prepareSourcePath = function (sourceFileName, preparedFileName, contents) {
            var io = this.ioHost;
            if (this.options.outputOne) {
                return contents;
            }
            if (sourceFileName === preparedFileName) {
                return contents;
            }
            if (!this.options.destinationPath) {
                return contents;
            }
            if (!(/\.js\.map$/.test(sourceFileName))) {
                return contents;
            }
            var mapData = JSON.parse(contents), source = mapData.sources[0];
            mapData.sources.length = 0;
            var relative = io.relativePath(io.dirName(preparedFileName), sourceFileName);
            mapData.sources.push(io.combine(io.dirName(relative), source));
            return JSON.stringify(mapData);
        };

        Task.prototype.createDirectoryStructure = function (dirName) {
            if (this.ioHost.directoryExists(dirName)) {
                return;
            }

            var parentDirectory = this.ioHost.dirName(dirName);
            if (parentDirectory != "") {
                this.createDirectoryStructure(parentDirectory);
            }
            this.ioHost.createDirectory(dirName);
        };

        Task.prototype.directoryExists = function (path) {
            return this.ioHost.directoryExists(path);
            ;
        };

        Task.prototype.resolvePath = function (path) {
            var cachedValue = this.resolvePathCache[path];
            if (!cachedValue) {
                cachedValue = this.ioHost.resolvePath(path);
                this.resolvePathCache[path] = cachedValue;
            }
            return cachedValue;
        };
        return Task;
    })();
    GruntTs.Task = Task;
})(GruntTs || (GruntTs = {}));
///<reference path="../typings/gruntjs/gruntjs.d.ts" />
///<reference path="../typings/node/node.d.ts" />
///<reference path="../typings/q/Q.d.ts" />
///<reference path="io.ts" />
///<reference path="opts.ts" />
///<reference path="task.ts" />
module.exports = function (grunt) {
    var _path = require("path"), _vm = require('vm'), _os = require('os'), Q = require('q'), getTsBinPathWithLoad = function () {
        var typeScriptBinPath = _path.dirname(require.resolve("typescript")), typeScriptPath = _path.resolve(typeScriptBinPath, "typescript.js"), code;

        if (!typeScriptBinPath) {
            grunt.fail.warn("typescript.js not found. please 'npm install typescript'.");
            return "";
        }

        code = grunt.file.read(typeScriptPath);
        _vm.runInThisContext(code, typeScriptPath);

        return typeScriptBinPath;
    }, setGlobalOption = function (options) {
        if (!TypeScript || !options) {
            return;
        }
        TypeScript.newLine = function () {
            return _os.EOL;
        };
        if (options.newLine !== 2 /* auto */) {
            TypeScript.newLine = (function (v) {
                return function () {
                    return v;
                };
            })(options.newLine === 0 /* crLf */ ? "\r\n" : "\n");
        }
        if (options.indentStep > -1) {
            TypeScript.Indenter.indentStep = options.indentStep;
            TypeScript.Indenter.indentStepString = Array(options.indentStep + 1).join(" ");
        }
        if (options.useTabIndent) {
            TypeScript.Indenter.indentStep = 1;
            TypeScript.Indenter.indentStepString = "\t";
        }
    };

    grunt.registerMultiTask('typescript', 'Compile TypeScript files', function () {
        var self = this, typescriptBinPath = getTsBinPathWithLoad(), promises = [], done = self.async();
        self.files.forEach(function (gruntFile) {
            var io = new GruntTs.GruntIO(grunt), opts = new GruntTs.Opts(self.options({}), grunt, gruntFile, io);

            setGlobalOption(opts);
            promises.push((new GruntTs.Task(grunt, typescriptBinPath, io)).start(opts));
        });
        Q.all(promises).then(function () {
            done();
        }, function () {
            done(false);
        });
    });
};
