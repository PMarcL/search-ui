const gulp = require('gulp');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const fs = require('fs');
const runsequence = require('run-sequence');

gulp.task('definitions', function (done) {
  runsequence('internalDefs', 'externalDefs', 'cleanDefs', done);
})

gulp.task('cleanDefs', function () {
  return gulp.src('bin/ts/CoveoJsSearch.d.ts')
      .pipe(replace(/import.*$/gm, ''))
      .pipe(replace(/(declare module )(.*)( {$)/gm, '$1Coveo$3'))
      .pipe(gulp.dest('bin/ts/'));
})

gulp.task('externalDefs', function () {
  return gulp.src([
        './typings/browser/ambient/underscore/index.d.ts',
        './typings/browser/ambient/jquery/index.d.ts',
        './lib/MagicBox.d.ts',
        './node_modules/modal-box/bin/ModalBox.d.ts',
        './lib/d3.d.ts',
        './lib/fastclick.d.ts',
        './lib/promise.d.ts',
        './lib/globalize.d.ts',
        './lib/jstz.d.ts',
        './lib/coveoanalytics.d.ts'
      ])
      .pipe(concat('Externals.d.ts'))
      .pipe(gulp.dest('./bin/ts'));
})

gulp.task('internalDefs', function () {
  return require('dts-generator').default({
    name: 'Coveo',
    project: './',
    baseDir: './src/',
    out: 'bin/ts/CoveoJsSearch.d.ts',
    externs: ['Externals.d.ts'],
    exclude: ['lib/**/*.d.ts', 'node_modules/**/*.d.ts', 'typings/**/*.d.ts', 'src/Index.ts', 'src/Doc,ts', 'bin/**/*.d.ts']
  });
})


function removeDuplicateDeclarations(content, declaration) {
  var firstDeclaration = content.indexOf(declaration);
  console.log(firstDeclaration)
  while (content.lastIndexOf(declaration) != firstDeclaration) {
    console.log(content.lastIndexOf(declaration))
    var lastDeclaration = content.lastIndexOf(declaration);
    var endOfLastDeclaration = content.indexOf('}', lastDeclaration);
    console.log(endOfLastDeclaration)
    content = content.substr(0, lastDeclaration) + content.substr(endOfLastDeclaration + 1);
  }
  return content;
}

