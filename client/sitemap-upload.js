import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import assert from 'assert'
import path from 'path'
//const XLSX = require('xlsx'); // npm install xlsx

import './sitemap-upload.html';

import XLSX_sitemap from './lib/xlsx-sitemap.js';

let src_fileName = null;
//let xlsx_data = null; // set by validate
//let xlsx_file = null; // an object with all file props.

const TP = Template['sitemap-upload'];

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
    const mp = new XLSX_sitemap()
    mp.init(data)
    tp.xlsx_data = mp.xlsx
    //console.log(mp.xlsx) // Array
    while(true) {
      const retv1 = await mp.getNext({validate:true});
//      const {lineNo, maxCount, url, status, en, next} = retv1;
      const {lineNo, maxCount, url, next} = retv1;

      lineNo_ = lineNo;
      //console.log({retv1})
      console.log('validation-status',`${lineNo}/${maxCount} (${mp.log.length}) -- ${url}`)
      Session.set('validation-status',`${lineNo}/${maxCount} (${mp.log.length}) -- ${url}`)
      if (next<0) break;
    }

    console.log(`@73`,mp.xlsx)

    console.log(`@74 log:\n`, mp.log.join('\n'))
    Session.set('validation-status',`done ${lineNo_}/${mp.xlsx.length} errors:${mp.log.length}`)
    reset_v2(tp,'publish')
  }
}) // events


TP.events({
  'click .js-publish': async (e,tp)=>{
    const active = e.target.classList.contains('active')
    if (!active) return;
    freeze_orange(tp,'publish')

    Session.set('upload-status','uploading')
    // here the file goes to the server,
    console.log(tp.xlsx_file)

    if(!tp.xlsx_file) {
      Session.set('upload-status', 'sys-error@113 -- missing-file')
      return;
    }
    const {name, lastModifiedDate, size} = tp.xlsx_file;
    console.log({name})
    console.log(tp.xlsx_data)

    if (!tp.xlsx_data) {
      const data = await read_async(tp.xlsx_file)
      const mp = new XLSX_sitemap()
      mp.init(data)
      tp.xlsx_data = mp.xlsx
    }

    console.log(`@124:`,tp.xlsx_data)


    if(!tp.xlsx_data) {
      Session.set('upload-status','sys-error@124 -- no-data')
      return;
    }

    if (! Array.isArray(tp.xlsx_data)) {
      Session.set('upload-status','sys-error@114 -- not-an-array')
      return;
    }

    /**
    //  sort the array
    **/
    //console.log(`@222 tp.xlsx_data:`,tp.xlsx_data)
    tp.xlsx_data.sort((a,b)=>{
      return a.en.localeCompare(b.en,'en',{sensitivity:'base'})
    })

    return new Promise((resolve,reject)=>{
      Meteor.call('mk-sitemap',{opCode:'s3.putObject',
        s3fn: 's3://blueink/dkz/sitemap.yaml',
        name, lastModifiedDate, size, data: JSON.stringify(tp.xlsx_data),
      }, (err,retv3)=>{
        console.log(`@232`,{err},{retv3})
        if (err) {
          console.log({err})
          reject(err)
        }
        if (retv3.error) {
          console.log({retv3})
          Session.set('upload-status',`fail : ${retv3.error}`)
          reject(retv3)
        }

        Session.set('upload-status','success.')
        console.log({retv3})
        reset_v2(tp,'')
        resolve()
      })
    })
  }
});

// ---------------------------------------------------------------------------

/**
//    ALSO defined elsewhere
**/

async function upload1(s3fn, file) {
  const {name, lastModifiedDate, size, _ready_for_upload} = file;
  console.log({name})

  const {ext} = path.parse(name);
  console.log({ext})
//  let data;

  switch(ext) {
    case '.md':
    case '.txt':
    data = await readAsText(file);
    break;

    case '.jpg':
    case '.jpeg':
    case '.pdf':
    case '.docx':
    data = await readAsArrayBuffer(file);
    data = new Uint8Array(data) // convert to binary
    break

    default:
      throw `fatal@192 Invalid ext <${ext}>`
  }


  // {opCode, file, data, dest_fileName} = o;

  return new Promise((resolve , reject)=>{
    Meteor.call('upload1', { opCode:'s3.putObject', file,
      s3fn,
      name, lastModifiedDate, size, data}, (err,retv)=>{
        if (err) {
          console.log({err})
          console.log(`upload1 <${name}> result failed.`)
          file._status = 'failed'
          reject(err)
        } else {
          console.log({retv})
          console.log(`upload1 <${name}> result Ok.`)
          file._status = 'uploaded'
          Session.set('upload-status',`${file.name} uploaded.`)
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

FlowRouter.route('/upload-sitemap', {
  action: function(params, queryParams){
        //console.log('Router::action for: ', FlowRouter.getRouteName());
        //console.log(' --- params:',params);
    BlazeLayout.render('sitemap-upload',params);
  }
});
