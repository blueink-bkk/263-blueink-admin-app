const assert = require('assert');
const path = require('path')
const yaml = require('js-yaml')

const writeJsonFile = require('write-json-file');
const loadJsonFile = require('load-json-file');

const s3 = require('264-aws-s3')(process.env);


/**
//    Simulate cache to a database
//
//    list all products
//    list all catalogs

//    list all products for a catalog.
//    list all catalogs fo a product

//    load from s3://bucket
//    store to s3://bucket
//    apply xlsx updater

**/


class CatIndex {
  constructor() {
    this.indexp ={}; // {catlist:[], status}
    this.catlist = {}; // {products:[], mtime}
  }

  async load(s3fn) {
    const verbose =1;
    ;(verbose) && console.log(`CatIndex.load <${s3fn}>`)
    const indexp = await load_indexp_cache(s3fn)
    for (const xid of Object.keys(indexp)) {
      indexp[xid].catlist = indexp[xid].catlist.split(':')
    }
    this.indexp = indexp;
    const catlist = this.select_catalogs(); // Array
    ;(verbose) && console.log(`@40 catlist:`,catlist)

    catlist.forEach(catNo =>{
      this.catlist[catNo] = {}
    })


    /**
    //  Merge mtime
    **/
    await this.merge_mtime()
    ;(verbose) && console.log(`@48 `,this.catlist);
    ;(verbose) && console.log(`exit CatIndex.load <${s3fn}> catlist:${catlist.length}`)
  }

  async merge_mtime() {
    const verbose =1;
    let dir = await s3.ls_objects('s3://blueink/en/new-products-')
    ;(verbose) && console.log(`@47:`,{dir})
    if (!Array.isArray(dir)) throw 'fatal@50'
    dir = dir.map(it => {
      const v = it.Key.match(/en\/new\-products\-(\d\d)\.html/)
      if (!v) return {catNo:null} // for filter later
      if (!Array.isArray(v)) throw `fatal@53 <${it.Key}>`
      const [,catNo] = v
      const mtime = new Date(it.LastModified)
      return {catNo, mtime}
    }).filter(it => (it.catNo))
    .forEach(it =>{
      ;(verbose) && console.log(`@60:`,it);
      ;(verbose) && console.log(`@61:`,this.catlist[it.catNo]);
      this.catlist[it.catNo].mtime = it.mtime;
    })

    ;(verbose) && console.log(`@53:`,this.catlist)
  }

  dump(s3fn) {
  }


  apply_xlsx({data}) {

  }

  select_products({catNo}) {
    if (!catNo) return Object.keys(this.indexp);
    return Object.keys(this.indexp)
        .filter(xid => (this.indexp[xid].catlist.includes(catNo)))
  }

  select_catalogs(o) {
    const {xid} = o||{};
    if (xid) {
      return this.indexp[xid].catlist;
    }

    // find catalogs having xid.
    const catlist = new Set();
    for (const xid of Object.keys(this.indexp)) {
//      array.forEach(mySet.add, mySet)
//      this.indexp.catlist.forEach (catNo => {catlist.add(catNo)});

      //console.log(this.indexp[xid])
      this.indexp[xid].catlist.forEach(catlist.add, catlist); // WOW......
    }
    return Array.from(catlist).sort();
  }

} // CatIndex


const catIndex = new CatIndex();

module.exports = catIndex;

// --------------------------------------------------------------------------


// --------------------------------------------------------------------------


async function load_indexp_cache(fpath) {
  if (fpath.startsWith('s3://')) {
    const retv1 = await s3.getObject(fpath)
    if (!retv1 || retv1.error) {
      console.error(`halted@105 file-not-found <${fpath}>`);
      process.exit(-1)
    }

    const data = retv1.Body.toString('utf8')
    if (fpath.endsWith('.json')) {
      return JSON.parse(data)
    }
    else
    if (fpath.endsWith('.yaml')) {
      return yaml.load(data, 'utf8');
    }
    else {
      console.error(`halted@118 Unknow format for input <${fpath}>`);
      process.exit(-1)
    }
  } else {
    const data = fs.readFileSync(fpath,'utf8')
    if (fpath.endsWith('.json')) {
      return JSON.parse(data)
    }
    else
    if (fpath.endsWith('.yaml')) {
      return yaml.load(data, 'utf8');
    }
    else {
      console.error(`halted@118 Unknow format for input <${fpath}>`);
      process.exit(-1)
    }
  } // YAML/JSON
} // load_indexp
