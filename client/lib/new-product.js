import assert from 'assert';
const yaml = require('js-yaml')

/**
//  from directory list :
//      read MD file for each lang
//      validate MD
//      iSeq must be found in MD file.
**/

module.exports = {
  validate_np_folder,
  upload1_product
}


/**
//  read EN.MD : validate the
**/

async function validate_np_folder(files, o={}) {
  const {verbose=0} =o;
  const hh = {};
  const err_list =[];


  for (file of files) {
    console.log({file})
    if (file.name == 'index-en.md') hh['en'] = file;
    else if (file.name == 'index-th.md') hh['th'] = file;
    else if (file.name.endsWith('.pdf')) hh.pdf = file;
    else if (file.name.endsWith('.jpg')) hh.jpeg = file;
    else if (file.name.endsWith('.docx')) hh.docx = file;
    else err_list.push(`unknown file <${file.name}> found in batch`)
  }


  if (!hh.pdf) {
    err_list.push(`PDF is missing`)
  } else if (hh.pdf.name.indexOf(' ')>=0) {
    err_list.push(`Invalid char found in <${hh.pdf.name}>`)
  }

  if (!hh.jpeg) {
    err_list.push(`JPEG is missing`)
  } else if (hh.jpeg.name.indexOf(' ')>=0) {
    err_list.push(`Invalid char found in <${hh.pdf.name}>`)
  }

  if (!hh['en']) {
    err_list.push(`index-en.md is missing`)
  }

  if (!hh['th']) {
    err_list.push(`index-th.md is missing`)
  }

  if (err_list.length >0) {
    console.log({err_list})
    return {err_list}
  }

  // now vaidate MD syntax.
  console.log({hh})


  /**
  //
  **/

  await validate_md(hh.en)
  await validate_md(hh.th)


  async function validate_md(file) {
    const data = await read_local_file(file)
    const {meta,data:md} = metadata_from(data)
    console.log({meta})

    if (!meta.xid) err_list.push('metadata: Missing xid')
    else if (meta.xid.indexOf('-')<0) err_list.push('metadata: xid must have at least 1 dash')

    if (!meta.img) err_list.push('metadata: Missing img')
    else if (meta.img != hh.jpeg.name)  err_list.push(`metadata: <img> file-not-found <${meta.img}><${hh.jpeg.name}>`)
    else hh.jpeg._ready_for_upload = true;

    if (!meta.pdf) err_list.push('metadata: Missing pdf')
    else if (meta.pdf != hh.pdf.name)  err_list.push(`metadata: <pdf> file-not-found <${meta.pdf}><${hh.pdf.name}>`)
    else hh.pdf._ready_for_upload = true;

    if (!meta.type) err_list.push('metadata: Missing product type')

    meta.catlist = "01"

    if (!meta.catlist) err_list.push('metadata: Missing catlist'); // possibly "00"
    else {
      const v = meta.catlist.split(':')
      v.forEach(catNo =>{
  //      if ((''+catNo).length !=0) err_list.push('metadata: catNo MUST be 2 digits');
        if (!/^\d\d$/.test(''+catNo))  err_list.push(`metadata: catNo <${catNo}> in <${meta.catlist}> MUST be 2 digits`);
      })
    }


    // EXIT IF ERROR

    file._ready_for_upload = true;
  } // validate



  if (err_list.length >0) {
    console.log({err_list})
    Session.set('err-list',err_list.join('\n'))
    return {err_list}
  }

  /**
  //  Now we can upload index-en.md
  **/

  for (file of files) {
//    console.log(`-- `,file)
    if (file._ready_for_upload) {
      console.log(`-- <${file.name}> READY`)
    } else {
      console.log(`-- <${file.name}> LOST`)
    }
  }



  /****************************************************************
  // const {opCode, file, data, dst_fileName} = o;
  Meteor.call('upload1',{opCode:'np-th', file:hh.th,
    dest_fileName:`s3://blueink/np14/${meta.xid}/${hh.th.name}`},(err,retv)=>{
    if (err) console.log({err})
    // populate slot-en
  })

  // const {opCode, file, data, dst_fileName} = o;
  Meteor.call('upload1',{opCode:'np-pdf', file:hh.pdf,
    dest_fileName:`s3://blueink/np14/${meta.xid}/${hh.pdf.name}`},(err,retv)=>{
    if (err) console.log({err})
    // populate slot-en
  })

  // const {opCode, file, data, dst_fileName} = o;
  Meteor.call('upload1',{opCode:'np-jpeg', file:hh.img,
    dest_fileName:`s3://blueink/np14/${meta.xid}/${hh.jpeg.name}`},(err,retv)=>{
    if (err) console.log({err})
    // populate slot-en
  })

  ****************************************************************/



  return {status:'ok',hh}
}

// ---------------------------------------------------------------------------

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


async function read_local_file(file) {
  console.log('read_local_file', {file})
  const reader = new FileReader();
//  Session.set('validation-status','running')

  return new Promise((resolve,reject)=>{
    reader.onload = async function(e) {
      console.log(reader.result)

  //    const data = new Uint8Array(reader.result);
  //    xlsx_data = await xlsx_decode_sitemap(data);
  //    console.log(data.toString('utf8'))
      resolve(reader.result)
    }
  //  reader.readAsArrayBuffer(file);
    reader.readAsText(file,'utf8'); // MD
  }); // promise
}


async function upload1_product(params) {

  const {batch_folder, dir, iSeq, lang, sku} = params;

  console.log(params)
  return;


  const v3 = fs.readdirSync(path.join(batch_folder,fn)); // EXISTING

  const index_fn = `index-${lang.toLowerCase()}.md`;
  const md_fn = path.join(batch_folder, fn, index_fn);
  if (!fs.existsSync(md_fn)) {
    console.log(`ALERT@46 missing-md-file <${fn}/${index_fn}>`)
    return;
  }

  console.log(`found <${md_fn}>`)

  const md = fs.readFileSync(md_fn,'utf8')
  if (!md || md.length<=0) {
    console.log(`ALERT@21 missing-md-file <${fn}/${index_fn}>`)
  }

    //  console.log({md})
  const {meta,data} =  metadata_from(md);
    //  console.log({meta})
    //  validate_product()

  const xid = `${iSeq}-${sku}`

  //console.log(`meta.xid:${meta.xid}`)
  if (!(''+meta.xid).startsWith(iSeq)) {
    console.log(`ALERT@65 data corrupted xid:<${xid}> iSeq:<${iSeq}>`, {meta})
    process.exit(-1);
  }

  if (meta.xid && meta.xid != xid) {
    console.log(`ALERT@72 altering xid:<${xid}> meta.xid:<${meta.xid}>`)
    meta.xid = xid;
  }

      /**
      //  check each file from MD exists in folder.
      **/

  if (!v3.includes(meta.img)) {
    console.log(`ALERT@81 JPEG: <${meta.img}> not found in batch.`)
    process.exit(-1);
  }

  if (!v3.includes(meta.pdf)) {
    console.log(`ALERT@63 PDF: <${meta.pdf}> not found in batch.`)
    process.exit(-1);
  }

      /**
      //  NOW : we can upload files to s3://blueink
      **/

  if (dry_run) {
    console.log(`DRY-RUN s3://${Bucket} not updated.`)
    return;
  }


  const s3fn = `s3://blueink/np14/${xid}/${index_fn}`
  console.log(`WRITING ${s3fn}`)

  const retv2 = await s3.putObject(s3fn, `---\n${yaml.dump(meta)}\n---\n${data}\n`)
  if (!retv2 || retv2.error) {
    err_list.push(`error writing <${s3fn}>`)
    return;
  }

} // upload1_product
