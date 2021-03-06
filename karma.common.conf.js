module.exports = {
  frameworks: ['jasmine'],
  files: [
    {
      pattern: './node_modules/jasmine-core/lib/jasmine-core/jasmine.css',
      watched: false
    },
    {
      pattern: './test/lib/jasmine-2.4.1/jasmine.css',
      watched: false
    },
    {
      pattern: './test/lib/jasmine-ajax/jasmine-ajax.js',
      watched: false
    },
    {
      pattern: './test/lib/jquery.js',
      watched: false
    },
    {
      pattern: './bin/js/CoveoJsSearch.js',
      watched: true
    },
    {
      pattern: './bin/js/CoveoJsSearch.dependencies.js',
      watched: false
    },
    {
      pattern: './bin/tests/tests.js',
      watched: true
    }
  ],
  plugins: [
    'karma-jasmine',
    'karma-chrome-launcher',
    'karma-phantomjs-launcher',
    'karma-coverage'
  ],
  preprocessors: {
    './bin/js/CoveoJsSearch.js': 'coverage'
  },
  reporters: ['progress', 'coverage'],
  coverageReporter: {
    type: 'text-summary'
  }
}
