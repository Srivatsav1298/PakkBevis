var path=require('path'),pw=require('playwright');
(async function(){var b=await pw.chromium.launch(),pg=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
await pg.goto('file://'+path.join(__dirname,'..','index.html'));await pg.waitForSelector('#orderSel');
await pg.selectOption('#orderSel',process.argv[2]||'O1002');
await pg.screenshot({path:path.join(__dirname,'phone-top.png')});
await pg.screenshot({path:path.join(__dirname,'phone-full.png'),fullPage:true});await b.close();})();
