const gulp = require('gulp');
const rename = require('gulp-rename');
gulp.task('default', () =>
  gulp.src('dist/main*.js')
      .pipe(rename('plugin.js'))
      .pipe(gulp.dest('dist'))
);
