import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import assert from 'assert'
import path from 'path'

import './new-product.html';
import utils from './lib/new-product.js'
import {NP_uploader, readAsText, readAsArrayBuffer} from './lib/np-uploader.js'
const TP = Template['new-product'];

TP.onCreated(()=>{
  console.log('onCreated')
})


TP.events({
  'click .js-reset': async (e,tp)=>{
    console.log(`reset`)
//    reset(tp,0)
    reset_v2(tp,'lookup')
    tp.find('input#np-folder').removeAttribute('disabled')
  }
});


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


function xid_from_file(file) {
  const {dir,base} = path.parse(file.webkitRelativePath);
  const v = dir.match(/^(\d{4,4})\^/);
  console.log({v})
  const iSeq = v && v[1];
  return {dir,base,iSeq}
}

async function xid_lookup(iSeq) {
  assert(iSeq, 'fatal@77')
  return new Promise((resolve,reject) =>{
    console.log(`call xid-lookup(${iSeq})`)
    Meteor.call('xid-lookup',iSeq,(err,data)=>{
      //console.log({err})
      if (err) reject(err);
      //console.log({data})
      resolve(data)
    })
  })
}



TP.events({
  'change #np-folder': async (e,tp)=>{
    const files = document.getElementById("np-folder").files;
//    console.log({xlsx_file})
//    src_fileName = xlsx_file.name
//    console.log({files})
//    for (file of files) {
//      console.log({file})
//    }

    const retv1 = xid_from_file(files[0])
    const {dir,iSeq} = retv1;

    if (!iSeq) {
      console.log({retv1})
      console.log(`files[0]:`, files[0])
      console.log(`ALERT@106`,{dir})
      return;
    }


    const retv2 = await xid_lookup(iSeq)
    console.log(`xid-lookup:`, {retv2})
    if (retv2.xid) {
      // ALERT : THIS PRODUCT ALREADY EXISTS.
      Session.set('upload-status','ALERT: this product already exists')
      return;
    }

    const u = new NP_uploader(files, {verbose:1});
    tp._updater = u;
    //console.log(u.err_list)
    //console.log(u.hh)

    console.log(`hh:`, u.hh)
    show_dir(tp, u.hh)

    if (!u.hh.en) {
      Session.set('upload-status','ALERT: Missing MD-file <index-en.md>')
      return;
    } else {
      const meta_en = await u.validate_md(u.hh.en)
      console.log(`err-list:`,u.err_list)
      const prefix = ''+iSeq+'-';
      if (!meta_en.xid.startsWith(prefix)) {
        alert(`pb@87 iSeq:${iSeq} <${meta_en.xid}>`)
      }
    }

    if (!u.hh.th) {
      Session.set('upload-status','ALERT: Missing MD-file <index-th.md>')
      return;
    } else {
      const meta_th = await u.validate_md(u.hh.th)
      console.log(`err-list:`,u.err_list)
      if (!meta_th.xid.startsWith(''+iSeq+'-')) {
        alert('pb@93')
      }
    }


    reset_v2(tp, 'upload')
    tp.find('input#np-folder').setAttribute('disabled','disabled')

    return

    if (err_list && err_list.length>0) {
      Session.set('err-list',err_list.join('\n'))
    }

//
} // change
}) // events


function show_dir(tp,hh) {
  const li =[];
  for (file of Object.values(hh)) {
    //console.log({file})
    li.push(`${file.name} passed:${file._ready_for_upload} status:${file._status}`)
  }
  Session.set('files-ready',li.join('\n'))
}

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


TP.events({
  'click .js-upload': async (e,tp) => {
    const u = tp._updater;
    console.log(`hh:`, u.hh)
    freeze_orange(tp,'upload')

    for (file of Object.values(u.hh)) {
      const s3fn = `s3://blueink/np14/${u.xid}/${file.name}`;
      await upload1(s3fn, file);
    } // loop
    Session.set('upload-status','all files uploaded')
    reset_v2(tp,'')
  } // click
}) // events


FlowRouter.route('/new-product', {
  action: function(params, queryParams){
        //console.log('Router::action for: ', FlowRouter.getRouteName());
        //console.log(' --- params:',params);
    BlazeLayout.render('new-product',params);
  }
});
