import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import assert from 'assert'
import path from 'path'
const yaml = require('js-yaml')
//const XLSX = require('xlsx'); // npm install xlsx

import './upload-np-directory.html';

import XLSX_np_directory from './lib/xlsx-np-directory.js';

let src_fileName = null;
//let xlsx_data = null; // set by validate
//let xlsx_file = null; // an object with all file props.

const TP = Template['np-directory'];

TP.onCreated(()=>{
  console.log('onCreated')
  this.phase = new ReactiveVar('init')
})

TP.onRendered(()=>{
  const tp = this;
  console.log('onRendered')
  Session.set('validation-status','')
  Session.set('upload-status','')
  tp.xlsx_data = null; // set by validate
  tp.xlsx_file = null; // an object with all file props.
  tp.phase.set('init');
// not work here  reset_v2(this,'lookup')
})

const phase = 'upload'

TP.helpers({
  filter: (x) =>{
    return (x != phase);
  }
})


async function read_async(xlsx_file) {
  const reader = new FileReader();
  return new Promise((resolve,reject)=>{
    reader.onload = async function(e) {
      const data = new Uint8Array(reader.result);
      //console.log({data})
      resolve(data)
    }
    reader.readAsArrayBuffer(xlsx_file);
  })
}



function reset_v2(tp, menu) {
  menu = menu.split(':')
//  console.log({menu})
  const v = tp.findAll('.menu1')
//  console.log({v})
  v.forEach(btn =>{
  //  console.log(btn.getAttribute('name'))
    const name = btn.getAttribute('name');
    btn.classList.remove('running')

    if (menu.includes(name)) {
    //  console.log(`add active to ${name}`)
      btn.classList.add('active')
    } else {
      //console.log(`remove active from ${name}`)
      btn.classList.remove('active')
    }
  })
} // reset

function freeze_orange(tp, menu) {
  menu = menu.split(':')
//  console.log({menu})
  const v = tp.findAll('.menu1')
//  console.log({v})
  v.forEach(btn =>{
  //  console.log(btn.getAttribute('name'))
    const name = btn.getAttribute('name');
    btn.classList.remove('active')

    if (menu.includes(name)) {
    //  console.log(`add active to ${name}`)
      btn.classList.add('running')
    } else {
      //console.log(`remove active from ${name}`)
      btn.classList.remove('running')
    }
  })
} // reset

TP.events({
  'click input[type=checkbox]': ()=>{
    console.log(`check.`)
  }
});

TP.events({
  'click .js-reset': async (e,tp)=>{
    console.log(`reset`)
//    reset(tp,0)
    reset_v2(tp,'lookup')
    tp.find('input#xlsx-lookup').removeAttribute('disabled')
  }
});

TP.events({
  'change #xlsx-lookup': (e,tp)=>{
    const xlsx_file = document.getElementById("xlsx-lookup").files[0];
//    console.log({xlsx_file})
//    src_fileName = xlsx_file.name
    console.log({xlsx_file})
    tp.xlsx_file = xlsx_file;
    tp.xlsx_data = null; // invalidate !!!!
    Session.set('upload-status',`Selected: ${xlsx_file.name}`);
    Session.set('phase',1);
    //reset(tp,1)
    reset_v2(tp, 'validate:skip-validation')
    tp.find('input#xlsx-lookup').setAttribute('disabled','disabled')
//    <input id="xlsx-lookup"
  }
})


TP.events({
  'click .js-skip-validation': async (e,tp)=>{
    const active = e.target.classList.contains('active')
    if (!active) return;

    xlsx_file = document.getElementById("xlsx-lookup").files[0];
//    console.log({xlsx_file})
    src_fileName = xlsx_file.name
    console.log({xlsx_file})
    //    reset(tp,2)

//    Session.set('validation-status','running')
    const data = await read_async(xlsx_file)
    const dir = new XLSX_np_directory()
    dir.load_data(data)
    dir.xlsx_run(); // apply xlsx to empty indexp
    tp.indexp = dir.indexp;

    reset_v2(tp, 'publish')
  },

  'click .js-validate': async (e,tp)=>{
    const active = e.target.classList.contains('active')
    if (!active) return;

    freeze_orange(tp,'validate')
    xlsx_file = document.getElementById("xlsx-lookup").files[0];
//    console.log({xlsx_file})
    src_fileName = xlsx_file.name
    console.log({xlsx_file})
    let lineNo_ =0;

    Session.set('validation-status','running')
    const data = await read_async(xlsx_file)
    const dir = new XLSX_np_directory()
    dir.load_data(data)
    dir.xlsx_run(); // apply xlsx to empty indexp

    /**
    //    here we could have validation error => exit
    **/

    tp.indexp = dir.indexp
    //console.log(mp.xlsx) // Array

    /**
    // this is the real validation check if dir exists/
    **/

    const jMax = Object.keys(dir.indexp).length;
    let j =0;
    for (const xid of Object.keys(dir.indexp)) {
      const v = xid.match(/^(\d{4,})\-/)
      if (!v || v.length <2) {
        console.log({xid},v)
        throw `fatal@170 `
      }
      const retv1 = await xid_lookup(v[1])
      console.log({retv1})
      Session.set('validation-status',`${j++}/${jMax} -passed- xid_lookup <${xid}><${retv1}>`)
    }

//    Session.set('validation-status',`done ${lineNo_}/${mp.xlsx.length} errors:${mp.log.length}`)
    Session.set('validation-status',`done`)
    reset_v2(tp,'publish')
  }
}) // events

async function xid_lookup(xid) {
  assert(xid, 'fatal@200')
  return new Promise((resolve,reject)=>{
    console.log(`call xid-lookup(${xid})`)
    Meteor.call('xid-lookup',xid, (err,retv)=>{
      if (err) reject(err)
      resolve(retv)
    })
  })
}

TP.events({
  'click .js-publish': async (e,tp)=>{
    const active = e.target.classList.contains('active')
    if (!active) return;
    freeze_orange(tp,'publish')

    Session.set('upload-status','uploading')
    // here the file goes to the server,
    console.log(tp.indexp)

    if(!tp.indexp) {
      Session.set('upload-status', 'sys-error@113 -- missing-file')
      return;
    }

    const {name, lastModifiedDate, size} = tp.xlsx_file;
    console.log({name})
//    console.log(tp.xlsx_data)

    if (!tp.indexp) {
      throw 'fatal@227 indexp. should exists'
//      const data = await read_async(tp.xlsx_file)
//      const dir = new XLSX_np_directory() ....
//      mp.init(data)
//      tp.xlsx_data = mp.xlsx
    }

    console.log(`@124:`,tp.indexp)


    if(!tp.indexp) {
      Session.set('upload-status','sys-error@124 -- no-data')
      return;
    }

    /*
    if (! Array.isArray(tp.xlsx_data)) {
      Session.set('upload-status','sys-error@114 -- not-an-array')
      return;
    }*/


    /**
    // first save the indexp.yaml
    **/

    if (true) {
      const s3fn = 's3://blueink/index-np.yaml'
//      const data = yaml.dump(tp.indexp)
//console.log({data})
      const retv1 = await upload1({s3fn, data:JSON.stringify(tp.indexp)})
      console.log({retv1})
    }

    if (true) {
      // should we rebuild the catalogs.
    }


  } //publish
});

// --------------------------------------------------------------------------


async function upload1({s3fn, data}) {

  return new Promise((resolve , reject)=>{
    Meteor.call('upload1', { opCode:'s3.putObject',
      s3fn, data}, (err,retv)=>{
        if (err) {
          console.log({err})
          console.log(`upload1 <${s3fn}> result failed.`)
          reject(err)
        } else {
          console.log({retv})
          console.log(`upload1 <${s3fn}> result Ok.`)
          resolve(retv)
        }
    }) // call
  }) // promise
} // upload1



// ---------------------------------------------------------------------------

function decode_xlsx(raw_data) {
  console.log(raw_data)
}

// ---------------------------------------------------------------------------

FlowRouter.route('/np-directory', {
  action: function(params, queryParams){
        //console.log('Router::action for: ', FlowRouter.getRouteName());
        //console.log(' --- params:',params);
    BlazeLayout.render('np-directory',params);
  }
});
