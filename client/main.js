import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';
import './index.js'
import './sitemap-upload.js'
import './new-product.js'
import './mk-catalog.js'
import './api2.js'
import './test.js'
import './upload-np-directory.js'


Template.registerHelper('session', function (varName) {
  return Session.get(varName);
});

Template.registerHelper('equals', function (a, b) {
  return (a === b);
});
