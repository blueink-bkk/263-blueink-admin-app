
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


class XLSX_sitemap {

  constructor() {
    this.xlsx = null; // array of rows.
    this.log = [];
    this.lineNo = 0; // for validation
    return this;
  }

  // --------------------------------------------------------------------------

  async init(data) {
    var workbook = XLSX.read(data, {type: 'array'});
    var firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // header: 1 instructs xlsx to create an 'array of arrays'
  //  var result = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    this.xlsx = XLSX.utils.sheet_to_json(firstSheet, {
      header:[
          "url",            // A
          "status",          // B
          "en",             // english
          "th"              // thai
        ]
    });

    // data preview
  //      var output = document.getElementById('result');
  //      output.innerHTML = JSON.stringify(result, null, 2);
//    console.log(`@19`, this.xlsx);
    this.lineNo = 0; // for validation
//    return await validate(this.xlsx)
    this.log =[];

    for (const j in this.xlsx) {
      this.xlsx[j].url = this.xlsx[j].url || '#'
      this.xlsx[j].lineNo = this.xlsx[j].__rowNum__;
      this.xlsx[j].status = ''; // means not validated : later ok or "missing"
    }
  }

  // --------------------------------------------------------------------------

  async getNext(o) {
    const {validate} = o||{};
    const maxCount = this.xlsx.length

    if (this.lineNo>=maxCount) return null;
    const lineNo = this.lineNo++;
    const next = (this.lineNo>=this.xlsx.length)? -1: this.lineNo;
    const row = this.xlsx[lineNo]
    let {url, en, th, __rowNum__} = row;

    const retv = {lineNo: 1+__rowNum__, next, maxCount,url, en,th}

//    console.log(`--${+lineNo+1}`,row)


    // !url.startsWith('missing-url'
    if (!url.startsWith('http://ultimheat.co.th/')
        && !url.startsWith('http://www.ultimheat.co.th/')) {
      const msg = `${this.lineNo}/${maxCount} (${this.log.length}) url:<${url}> Invalid`;
      this.log.push(msg)
      row.error = 'Invalid URL';
      return Object.assign(retv,{error:'Invalid URL'});
    }

    if (!validate) {
//      const retv = {lineNo:this.lineNo, next, maxCount,url,status,en,th}
      return retv
    }

    if (url.startsWith('#')) {
  //    const retv = {lineNo:this.lineNo, next, maxCount,url,status,en,th}
  //    console.log({retv})
      this.log.push(`${this.lineNo}/${maxCount} (${this.log.length}) missing-url`)
      row.error = 'Missing URL';
      return Object.assign(retv,{error:'missing-url'});
    }

    // ------------------------------------------------------------------------

    const retv1 = await fetch(url) // just for header
    .catch(error => {
      const msg = `${this.lineNo}/${maxCount} url:<${url}> not found.`
      this.log.push(msg)
      console.log(`@86`,msg,{error})
      row.error = 'file-not-found';
      return Object.assign(retv,{error});
    })

    if (retv1.status == '404') {
      const msg = `${this.lineNo}/${maxCount} url:<${url}> 404 file-not-found.`
      this.log.push(msg)
      console.log(`@86`,msg)
      row.error = 'file-not-found (404)';
      return Object.assign(retv,{error:'404 file-not-found'});
    }


    const fileSize = retv1.headers.get('content-length')
    const mtime = retv1.headers.get('last-modified')
    //console.log(`-- ${+lineNo} <${url}> mtime:${mtime} size:${fileSize}`)

//    return {lineNo:this.lineNo, maxCount, url, status, mtime, fileSize, next, en, th};
    return Object.assign(retv,{mtime, fileSize, status:'ok'});

  } // validate_next

} // class XLSX_sitemap


module.exports = XLSX_sitemap;
