
const XLSX = require('xlsx'); // npm install xlsx
const assert = require('assert');


/**
//      WHEN USING THIS LIB IN EXTERNAL NODE PROGRAM.
**/

if (typeof window !== 'undefined') {
    // the variable is defined
} else {
  fetch = require('node-fetch');
  console.log({fetch})
}

class XLSX_np_directory {

  constructor() {
    this.xlsx = null; // array of rows.
    this.log = [];
    this.lineNo = 0; // for validation
    this.indexp ={};  // null if SYNC
    return this;
  }

  // --------------------------------------------------------------------------

  load_file(xlsx_fn) {
    var workbook = XLSX.readFile(xlsx_fn, {cellDates:true});
    const sheet1 = workbook.SheetNames[0];
    this.xlsx = XLSX.utils.sheet_to_json(workbook.Sheets[sheet1],{
      header:[
          "catNo",            // A
          "secName",          // B
          "sku",              // C
          "iSeq",             // D
          "status",           // E : jpeg
          "Note"]             // F
    });
    validate_xlsx(this.xlsx);
  }

  // -------------------------------------------------------------------------

  load_data(data) {

    var workbook = XLSX.read(data, {type: 'array', cellDates:true});
    const sheet1 = workbook.SheetNames[0];
    this.xlsx = XLSX.utils.sheet_to_json(workbook.Sheets[sheet1],{
      header:[
          "catNo",            // A
          "secName",          // B
          "sku",              // C
          "iSeq",             // D
          "status",           // E : jpeg
          "Note"]             // F
    });

    validate_xlsx(this.xlsx);
  }

  // -------------------------------------------------------------------------



  // --------------------------------------------------------------------------

  /**
  //    OPERATES on indexp : after xlsx_run()
  **/

  async fetch_Next(o) {
    const {indexp} = this;
    const {validate} = o||{};
    const keys = Object.keys(indexp);
    const maxCount = keys.length

    if (this.lineNo>=maxCount) return null;
    const lineNo = this.lineNo++;
    const next = (this.lineNo>=maxCount)? -1: this.lineNo;
    const xid = keys[lineNo]
    const p = indexp[xid]
    let {url, en, th, __rowNum__} = p;

    const retv = {lineNo: 1+__rowNum__, next, maxCount,url, en,th}

    if (!validate) {
//      const retv = {lineNo:this.lineNo, next, maxCount,url,status,en,th}
      return retv
    }

    // ------------------------------------------------------------------------

    const retv1 = await xid_loopup(xid);
    console.log({retv1})
//    return {lineNo:this.lineNo, maxCount, url, status, mtime, fileSize, next, en, th};
    return Object.assign(retv1,{mtime, fileSize, status:'ok'});

  } // fetchNext




} // class XLSX_np_directory

async function xid_lookup(xid) {
  assert(xid, 'fatal@108')

  return new Promise((resolve,reject)=>{
    console.log(`call xid-lookup(${xid})`)
    Meteor.call('xid-lookup',xid, (err,retv)=>{
      if (err) reject(err)
      resolve(retv)
    })
  })
}

// ---------------------------------------------------------------------------

function validate_xlsx(xlsx) {
  const verbose =0;
  for (let lineNo in xlsx) {
    if (lineNo <=0) continue;
    const row = xlsx[lineNo]
    let {catNo, secName, sku, iSeq, status, Note} = row;
    iSeq = parseInt((''+iSeq).trim())
    let removeAt = (Note && Note.search(/remove/i)); // remove
    if (removeAt == undefined) removeAt = -1;
    ;(verbose >2) && console.log({row})

    sku = (''+sku).trim();
    status = status.trim();
    const xid = `${iSeq}-${sku}`


    if (removeAt <0) { // "remove was not found in notes" = > KEEP IT

      let catNo = secName.trim().replace(/^([\d]+).*/, ($1,$2)=> ($2))
      catNo = (100 + parseInt(catNo)).toString().substring(1)
      xlsx[lineNo] = {xid,catNo,status}
    } else {
      row.removed = true; // instruction to remove that product
      xlsx[lineNo] = {xid,removed:true}
    }

    //console.log(`@93`,xlsx[lineNo])
  } // loop

  // --------------------------------------------------------------------------


  XLSX_np_directory.prototype.xlsx_run = function() {
    const indexp = this.indexp; // list produits (xlsx is rows)

    /************
    if (sync) {
      console.log(`ALERT CACHE/INDEX erased.`)
    } else {
      const fpath = input || './indexp.yaml';
      const indexp_ = await load_indexp_cache(fpath)
      Object.assign(indexp, indexp_)
    }
    **************/


    console.log(`@106 indexp.size: ${Object.keys(indexp).length}`)

    /**
    //      indexp/cache is initialized
    //      add/remove/update from xlsx
    **/


    let addCount =0;
    let delCount =0;
    let remCount =0;
    let replaceCount =0;

    for (let lineNo in xlsx) {
      // APPLY XLSX on INDEXP.

      if (lineNo <=0) continue;
      const row = xlsx[lineNo]
      let {catNo, xid, status, removed} = row;

      if (removed) {
        if (indexp[xid]) {
          indexp[xid] = undefined
          delCount +=1;
        }
        remCount +=1;
      } else {
        // add/replace
        if (verbose >1) console.log(`@124 ${(indexp[xid])?'replace':'add'} <${xid}>`)
        if (indexp[xid]) replaceCount +=1; else addCount +=1;
        indexp[xid] = indexp[xid] || {catlist:'', status:'init'}
        add_catNo(xid,catNo)
        assert(indexp[xid].catlist.length <=5)

      }
    }

    function add_catNo(xid,catNo) {
      const p = indexp[xid]
      // works fine here, because always 2 digits.

      assert(catNo.length ==2, 'invalid syntax for CatNo')

      if (p.catlist.indexOf(catNo)<0) {
    //    console.log(`@172 <${p.catlist}>`)
        p.catlist = p.catlist || ''
    //    console.log(`@173 <${p.catlist}>`)
        p.catlist = p.catlist+':'+catNo;
    //    console.log(`@174 <${p.catlist}>`)
        if (p.catlist.startsWith(':')) p.catlist = p.catlist.substring(1);
    //    console.log(`@174 <${p.catlist}>`)
        p.status = 'dirty'; // changed.
        return 1;
      }

      assert(p.catlist.length <=5)
      return 0;
    }



    const hli = 1;
    console.log(`@141 xlsx.size:${xlsx.length-hli} remCount:${remCount} (${xlsx.length-hli-remCount})`)
    console.log(`@141 indexp.size:${Object.keys(indexp).length}`)
    console.log(`@141 addCount:${addCount} replaceCount:${replaceCount} delCount:${delCount}`)


    /**
    //    here: each product is either init or dirty
    **/

    /*********************
    if (dry_run) {
      console.log(`DRY-RUN - nothing written`)
    } else {
      const fpath = output || input;
      await write_cache_indexp(fpath)
    }
    ********************/
    console.log(`exit async main - Ok.`)
  } // xlsx_run

  // -------------------------------------------------------------------------

} // validate_xlsx

// ----------------------------------------------------------------------------



module.exports = XLSX_np_directory;
