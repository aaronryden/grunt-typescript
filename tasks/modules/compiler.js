///<reference path="../../typings/typescript/typescript.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var GruntTs;
(function (GruntTs) {
    var Compiler = (function (_super) {
        __extends(Compiler, _super);
        function Compiler() {
            _super.apply(this, arguments);
        }
        Compiler.prototype.compileEmitTargets = function (emitTargets, libDPath, resolvePath, continueOnDiagnostics) {
            if (typeof continueOnDiagnostics === "undefined") { continueOnDiagnostics = false; }
            return new CompilerIterator(emitTargets, libDPath, this, resolvePath, continueOnDiagnostics);
        };
        return Compiler;
    })(TypeScript.TypeScriptCompiler);
    GruntTs.Compiler = Compiler;

    var CompilerPhase;
    (function (CompilerPhase) {
        CompilerPhase[CompilerPhase["Syntax"] = 0] = "Syntax";
        CompilerPhase[CompilerPhase["Semantics"] = 1] = "Semantics";
        CompilerPhase[CompilerPhase["EmitOptionsValidation"] = 2] = "EmitOptionsValidation";
        CompilerPhase[CompilerPhase["Emit"] = 3] = "Emit";
        CompilerPhase[CompilerPhase["DeclarationEmit"] = 4] = "DeclarationEmit";
    })(CompilerPhase || (CompilerPhase = {}));

    var CompilerIterator = (function () {
        function CompilerIterator(emitTargets, libDPath, compiler, resolvePath, continueOnDiagnostics, startingPhase) {
            if (typeof startingPhase === "undefined") { startingPhase = 0 /* Syntax */; }
            this.emitTargets = emitTargets;
            this.libDPath = libDPath;
            this.compiler = compiler;
            this.resolvePath = resolvePath;
            this.continueOnDiagnostics = continueOnDiagnostics;
            this.index = -1;
            this.fileNames = null;
            this._current = null;
            this._emitOptions = null;
            this._sharedEmitter = null;
            this._sharedDeclarationEmitter = null;
            this.hadSyntacticDiagnostics = false;
            this.hadSemanticDiagnostics = false;
            this.hadEmitDiagnostics = false;
            this.fileNames = compiler.fileNames();
            this.compilerPhase = startingPhase;
        }
        CompilerIterator.prototype.current = function () {
            return this._current;
        };

        CompilerIterator.prototype.moveNext = function () {
            this._current = null;

            while (this.moveNextInternal()) {
                if (this._current) {
                    return true;
                }
            }

            return false;
        };

        CompilerIterator.prototype.moveNextInternal = function () {
            this.index++;

            while (this.shouldMoveToNextPhase()) {
                this.index = 0;
                this.compilerPhase++;
            }

            if (this.compilerPhase > 4 /* DeclarationEmit */) {
                // We're totally done.
                return false;
            }

            switch (this.compilerPhase) {
                case 0 /* Syntax */:
                    return this.moveNextSyntaxPhase();
                case 1 /* Semantics */:
                    return this.moveNextSemanticsPhase();
                case 2 /* EmitOptionsValidation */:
                    return this.moveNextEmitOptionsValidationPhase();
                case 3 /* Emit */:
                    return this.moveNextEmitPhase();
                case 4 /* DeclarationEmit */:
                    return this.moveNextDeclarationEmitPhase();
            }
        };

        CompilerIterator.prototype.shouldMoveToNextPhase = function () {
            switch (this.compilerPhase) {
                case 2 /* EmitOptionsValidation */:
                    // Only one step in emit validation.  We're done once we do that step.
                    return this.index === 1;

                case 0 /* Syntax */:
                case 1 /* Semantics */:
                    // Each of these phases are done when we've processed the last file.
                    return this.index === this.fileNames.length;

                case 3 /* Emit */:
                case 4 /* DeclarationEmit */:
                    // Emitting is done when we get 'one' past the end of hte file list.  This is
                    // because we use that step to collect the results from the shared emitter.
                    return this.index === (this.fileNames.length + 1);
            }

            return false;
        };

        CompilerIterator.prototype.moveNextSyntaxPhase = function () {
            TypeScript.Debug.assert(this.index >= 0 && this.index < this.fileNames.length);
            var fileName = this.fileNames[this.index];

            //TODO: change
            if (fileName === this.libDPath) {
                return true;
            }
            var diagnostics = this.compiler.getSyntacticDiagnostics(fileName);
            if (diagnostics.length) {
                if (!this.continueOnDiagnostics) {
                    this.hadSyntacticDiagnostics = true;
                }

                this._current = TypeScript.CompileResult.fromDiagnostics(diagnostics);
            }

            return true;
        };

        CompilerIterator.prototype.moveNextSemanticsPhase = function () {
            // Don't move forward if there were syntax diagnostics.
            if (this.hadSyntacticDiagnostics) {
                return false;
            }

            TypeScript.Debug.assert(this.index >= 0 && this.index < this.fileNames.length);
            var fileName = this.fileNames[this.index];

            //TODO: change
            if (fileName === this.libDPath) {
                return true;
            }

            var diagnostics = this.compiler.getSemanticDiagnostics(fileName);
            if (diagnostics.length) {
                if (!this.continueOnDiagnostics) {
                    this.hadSemanticDiagnostics = true;
                }

                this._current = TypeScript.CompileResult.fromDiagnostics(diagnostics);
            }

            return true;
        };

        CompilerIterator.prototype.moveNextEmitOptionsValidationPhase = function () {
            TypeScript.Debug.assert(!this.hadSyntacticDiagnostics);

            if (!this._emitOptions) {
                this._emitOptions = new TypeScript.EmitOptions(this.compiler, this.resolvePath);
            }

            if (this._emitOptions.diagnostic()) {
                if (!this.continueOnDiagnostics) {
                    this.hadEmitDiagnostics = true;
                }

                this._current = TypeScript.CompileResult.fromDiagnostics([this._emitOptions.diagnostic()]);
            }

            return true;
        };

        CompilerIterator.prototype.moveNextEmitPhase = function () {
            var _this = this;
            TypeScript.Debug.assert(!this.hadSyntacticDiagnostics);
            TypeScript.Debug.assert(this._emitOptions);

            if (this.hadEmitDiagnostics) {
                return false;
            }

            TypeScript.Debug.assert(this.index >= 0 && this.index <= this.fileNames.length);
            if (this.index < this.fileNames.length) {
                var fileName = this.fileNames[this.index];

                //TODO: change
                if (!this.emitTargets.some(function (target) {
                    return target === fileName;
                })) {
                    return true;
                }

                var document = this.compiler.getDocument(fileName);

                // Try to emit this single document.  It will either get emitted to its own file
                // (in which case we'll have our call back triggered), or it will get added to the
                // shared emitter (and we'll take care of it after all the files are done.
                this._sharedEmitter = this.compiler._emitDocument(document, this._emitOptions, function (outputFiles) {
                    _this._current = TypeScript.CompileResult.fromOutputFiles(outputFiles);
                }, this._sharedEmitter);
                return true;
            }

            // If we've moved past all the files, and we have a multi-input->single-output
            // emitter set up.  Then add the outputs of that emitter to the results.
            if (this.index === this.fileNames.length && this._sharedEmitter) {
                // Collect shared emit result.
                this._current = TypeScript.CompileResult.fromOutputFiles(this._sharedEmitter.getOutputFiles());
            }

            return true;
        };

        CompilerIterator.prototype.moveNextDeclarationEmitPhase = function () {
            var _this = this;
            TypeScript.Debug.assert(!this.hadSyntacticDiagnostics);
            TypeScript.Debug.assert(!this.hadEmitDiagnostics);
            if (this.hadSemanticDiagnostics) {
                return false;
            }

            if (!this.compiler.compilationSettings().generateDeclarationFiles()) {
                return false;
            }

            TypeScript.Debug.assert(this.index >= 0 && this.index <= this.fileNames.length);
            if (this.index < this.fileNames.length) {
                var fileName = this.fileNames[this.index];

                //TODO: change
                if (!this.emitTargets.some(function (target) {
                    return target === fileName;
                })) {
                    return true;
                }

                var document = this.compiler.getDocument(fileName);

                this._sharedDeclarationEmitter = this.compiler._emitDocumentDeclarations(document, this._emitOptions, function (file) {
                    _this._current = TypeScript.CompileResult.fromOutputFiles([file]);
                }, this._sharedDeclarationEmitter);
                return true;
            }

            // If we've moved past all the files, and we have a multi-input->single-output
            // emitter set up.  Then add the outputs of that emitter to the results.
            if (this.index === this.fileNames.length && this._sharedDeclarationEmitter) {
                this._current = TypeScript.CompileResult.fromOutputFiles([this._sharedDeclarationEmitter.getOutputFile()]);
            }

            return true;
        };
        return CompilerIterator;
    })();
})(GruntTs || (GruntTs = {}));

module.exports = GruntTs;
