import assert from 'assert';
const yaml = require('js-yaml')


class NP_uploader {
  constructor(files, o={}) {
    const u = this;
    const {verbose=0} =o;
    u.verbose = verbose;
    u.hh ={};
    u.err_list =[];

    for (const file of files) {
      if (file.name == 'index-en.md') u.hh['en'] = file;
      else if (file.name == 'index-th.md') u.hh['th'] = file;
      else if (file.name.endsWith('.pdf')) u.hh.pdf = file;
      else if (file.name.endsWith('.jpg')) u.hh.jpeg = file;
      else if (file.name.endsWith('.docx')) u.hh.docx = file;
      else {
        u.err_list.push(`suspicious file <${file.name}> found in batch`)
        ;(verbose >0) && console.log(`suspicious file <${file.name}> found in batch : `,file)
      }
    }


    if (!u.hh.pdf) {
      u.err_list.push(`PDF is missing`)
    } else if (u.hh.pdf.name.indexOf(' ')>=0) {
      u.err_list.push(`Invalid char found in <${u.hh.pdf.name}>`)
    }

    if (!u.hh.jpeg) {
      u.err_list.push(`JPEG is missing`)
    } else if (u.hh.jpeg.name.indexOf(' ')>=0) {
      u.err_list.push(`Invalid char found in <${u.hh.pdf.name}>`)
    }

    if (!u.hh['en']) {
      u.err_list.push(`index-en.md is missing`)
    }

    if (!u.hh['th']) {
      u.err_list.push(`index-th.md is missing`)
    }

//    ;(verbose) && console.log(u.err_list)
//    ;(verbose) && console.log(u.hh)

  } // constructor

} // class

NP_uploader.prototype.test = function() {
  console.log('TEST')
}


function metadata_from(data) {
//  console.log({data})
  const v = data.trim().split(/\-\-\-/g); //match(yamlBlockPattern);
  assert(!v[0])
  assert(v.length == 3)
//  console.log(v)
  const meta = yaml.load(v[1], 'utf8');
//  console.log({meta})
  return {meta, data:v[2]}
}


async function readAsText(file) {
  //console.log('readAsText', {file})
  const reader = new FileReader();
//  Session.set('validation-status','running')

  return new Promise((resolve,reject)=>{
    reader.onload = async function(e) {
      //console.log(reader.result)

  //    const data = new Uint8Array(reader.result);
  //    xlsx_data = await xlsx_decode_sitemap(data);
  //    console.log(data.toString('utf8'))
      resolve(reader.result)
    }
  //  reader.readAsArrayBuffer(file);
    reader.readAsText(file,'utf8'); // MD
  }); // promise
}


async function readAsArrayBuffer(file) {
  //console.log('readAsArrayBuffer:', {file})
  const reader = new FileReader();
//  Session.set('validation-status','running')

  return new Promise((resolve,reject)=>{
    reader.onload = async function(e) {
      //console.log(reader.result)

  //    const data = new Uint8Array(reader.result);
  //    xlsx_data = await xlsx_decode_sitemap(data);
  //    console.log(data.toString('utf8'))
      resolve(reader.result)
    }
  //  reader.readAsArrayBuffer(file);
    reader.readAsArrayBuffer(file); // MD
  }); // promise
}



NP_uploader.prototype.validate_md = async function(file) {
  const u = this;
  const {verbose} = u;
  const data = await readAsText(file)
  const {meta,data:md} = metadata_from(data)
  console.log({meta})

  if (!meta.xid) u.err_list.push('metadata: Missing xid')
  else if (meta.xid.indexOf('-')<0) u.err_list.push('metadata: xid must have at least 1 dash')

  if (!meta.img) u.err_list.push('metadata: Missing img')
  else if (meta.img != u.hh.jpeg.name)  u.err_list.push(`metadata: <img> declaration missing <${meta.img}><${u.hh.jpeg.name}>`)
  else u.hh.jpeg._ready_for_upload = true;

  if (!meta.pdf) u.err_list.push('metadata: Missing pdf')
  else if (meta.pdf != u.hh.pdf.name)  u.err_list.push(`metadata: <pdf> declaration missing <${meta.pdf}><${u.hh.pdf.name}>`)
  else u.hh.pdf._ready_for_upload = true;

  if (!meta.type) u.err_list.push('metadata: Missing product type')

//  meta.catlist = "01"

  if (false) { // catlist obsolete here.
    if (!meta.catlist) u.err_list.push('metadata: Missing catlist'); // possibly "00"
    else {
      const v = meta.catlist.split(':')
      v.forEach(catNo =>{
  //      if ((''+catNo).length !=0) u.err_list.push('metadata: catNo MUST be 2 digits');
        if (!/^\d\d$/.test(''+catNo))  u.err_list.push(`metadata: catNo <${catNo}> in <${meta.catlist}> MUST be 2 digits`);
      })
    }
  }

  // EXIT IF ERROR

  if (!u.xid) u.xid = meta.xid
  else if (u.xid != meta.xid) {
    u.err_list.push(`xid do not match <${u.xid}><${meta.xid}>`)
  }

  file._ready_for_upload = true;
  return meta;
}


// ---------------------------------------------------------------------------

module.exports = {
  NP_uploader,
  readAsText,
  readAsArrayBuffer,
}
