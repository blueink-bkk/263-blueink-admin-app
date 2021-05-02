import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import assert from 'assert'
import path from 'path'

import './test.html';

const TP = Template.test;


TP.onCreated(()=>{
  console.log('onCreated')
})


TP.onRendered(()=>{
  console.log('onRendered')
})


FlowRouter.route('/test', {
  action: function(params, queryParams){
        //console.log('Router::action for: ', FlowRouter.getRouteName());
        //console.log(' --- params:',params);
    BlazeLayout.render('test', params);
  }
});
