import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import assert from 'assert'
import path from 'path'

import './index.html';

const TP = Template.index;

FlowRouter.route('/', {
  action: function(params, queryParams){
        //console.log('Router::action for: ', FlowRouter.getRouteName());
        //console.log(' --- params:',params);
    BlazeLayout.render('index', params);
  }
});
