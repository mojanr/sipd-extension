import './App.css';
import { Button, Empty, PageHeader, Typography } from 'antd';
import { useEffect, useState } from 'react';
import * as cheerio from 'cheerio'
import { read, utils, writeFile, writeFileXLSX } from 'xlsx';

function App() {

  // tabs id
  const [tabId, setTabId] = useState()
  const [info, setInfo] = useState({ program: null, kegiatan: null, subKegiatan: null, totalPagu: null })
  const [isPrintPage, setPrintPage] = useState(false)

  useEffect(() => {

    // console.log(document.getElementsByTagName('body'))

    // console.log('test')
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      // set tabs
      setTabId(tabs[0].id)

      // listener message rom content script
      chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
          if (request.action === 'sendBody') {
            console.log(request.data)
          }
        }
      );

      chrome.tabs.sendMessage(tabs[0].id, {
        action: "getBody"
      }, function (response) {
        // console.log(response);
        var $ = cheerio.load(response.data)

        // crawling
        // get nama program
        var program = $('.cetak table tbody tr:eq(7)').children('td:eq(2)').text()
        // get nama kegiatan
        var kegiatan = $('.cetak table tbody tr:eq(8)').children('td:eq(2)').text()
        // get nama sub kegiatan
        var subKegiatan = $('.cetak table tbody tr:eq(9)').children('td:eq(2)').text()
        // total pagu
        var totalPagu = $('.cetak table tbody tr:eq(20)').find('tbody tr:eq(2) td:eq(3)').find('table td').text()

        var hasPrintPage = $('body').children().hasClass('cetak') 

        // console.log(first)

        setPrintPage(hasPrintPage)
        setInfo({
          program,
          kegiatan,
          subKegiatan,
          totalPagu
        })
      });
    });


  }, [])

  // send message to content script

  // get body data
  const getBodyData = () => {
    chrome.tabs.sendMessage(tabId, {
      action: "getBody"
    }, function (response) {
      // console.log(response);
      var $ = cheerio.load(response.data)

      // crawling
      // get nama program
      var program = $('.cetak table tbody tr:eq(7)').children('td:eq(2)').text()
      // get nama kegiatan
      var kegiatan = $('.cetak table tbody tr:eq(8)').children('td:eq(2)').text()
      // get nama sub kegiatan
      var subKegiatan = $('.cetak table tbody tr:eq(9)').children('td:eq(2)').text()
      // total pagu
      var totalPagu = $('.cetak table tbody tr:eq(20)').find('tbody tr:eq(2) td:eq(3)').find('table td').text()

      var data = []
      $('.cetak table tbody tr:eq(32)').find('tbody tr').each((index, item) => {

        // template
        var row = {
          kodering: {
            kode: null,
            nama: null
          },
          children: [

          ]
        }

        // variable kode rekening
        var kodering = $(item).find('td:eq(0)').text().trim()
        row.kodering.kode = kodering

        if (kodering !== '' && kodering.split('.').length >= 6) {
          // get nama kodering 
          row.kodering.nama = $(item).find('td:eq(1)').text().trim().replace(/ +(?= )/g, '').replace(/\n/g, '')
          // push
          data.push(row)
        }
        else {
          var uraian = {
            nama: null,
            koefisien: null,
            satuan: null,
            harga: null,
            ppn: null,
            jumlah: null,
          }

          if (kodering === '') {
            // check if has 3 children
            if ($(item).children().length <= 3) {
              // tagging and keterangan
              uraian.nama = $(item).find('td:eq(1)').text().trim().replace(/ +(?= )/g, '')
              uraian.jumlah = $(item).find('td:eq(2)').text().trim().replace(/ +(?= )/g, '')
            } else {
              // komponen
              uraian.nama = $(item).find('td:eq(1)').text().trim().replace(/ +(?= )/g, '')
              uraian.koefisien = $(item).find('td:eq(2)').text().trim().replace(/ +(?= )/g, '')
              uraian.satuan = $(item).find('td:eq(3)').text().trim().replace(/ +(?= )/g, '')
              uraian.harga = $(item).find('td:eq(4)').text().trim().replace(/ +(?= )/g, '')
              uraian.ppn = $(item).find('td:eq(5)').text().trim().replace(/ +(?= )/g, '')
              uraian.jumlah = $(item).find('td:eq(6)').text().trim().replace(/ +(?= )/g, '')
            }
            // push
            data[data.length - 1].children.push(uraian)
          }
        }
      })
      console.log(data)


      // // normalize data
      // var normalizeData = []

      // data.forEach((item, index) => {
      //     // iterate through item
      //     item.children.forEach((row, index) => {
      //        var allRow =  {
      //             // program: program,
      //             // kegiatan: kegiatan,
      //             // subKegiatan: subKegiatan,
      //             kodering: item.kodering.kode,
      //             nama: item.kodering.nama,
      //             ...row
      //         }
      //         normalizeData.push(allRow)
      //     })
      // })
      // console.log(normalizeData)

      // normalize data v2
      var normalizeData = []
      data.forEach((item, index) => {
        // iterate through item
        // push kode rekening
        normalizeData.push({
          kodering: item.kodering.kode,
          uraian: item.kodering.nama,
          koefisien: null,
          satuan: null,
          harga: null,
          ppn: null,
          jumlah: null
        })
        item.children.forEach((row, index) => {
          var allRow = {
            kodering: null,
            uraian: row.nama,
            koefisien: row.koefisien,
            satuan: row.satuan,
            harga: row.harga,
            ppn: row.ppn,
            jumlah: row.jumlah
          }
          normalizeData.push(allRow)
        })
      })

      console.log('normalize data', normalizeData)

      // create excel
      const worksheetData = utils.json_to_sheet(normalizeData);
      const worksheetHeader = utils.json_to_sheet([{ program, kegiatan, subKegiatan, totalPagu }]);

      // create workbook
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheetHeader, "INFO");
      utils.book_append_sheet(workbook, worksheetData, "RINCIAN");

      // create file
      writeFile(workbook, `${subKegiatan.replace(/\//g, ' ')}.xlsx`);
    });
  }

  // get nama program
  // let program = $('.cetak table tbody tr:eq(7)').children('td:eq(2)').text()
  // get nama kegiatan
  // let kegiatan = $('.cetak table tbody tr:eq(8)').children('td:eq(2)').text()
  // get nama sub kegiatan
  // let subKegiatan =$('.cetak table tbody tr:eq(9)').children('td:eq(2)').text()

  // $('.cetak table tbody tr:eq(32)').find('tbody tr')

  // let data = []

  // $('.cetak table tbody tr:eq(32)').find('tbody tr').each((index, item) => {
  //     // console.log($(item).find('td:eq(0)').text().trim() == '')
  //     let row = {
  //         kodering: {
  //             kode: null,
  //             nama: null
  //         },
  //         children: [

  //         ]
  //     }

  //     // variable kode rekening
  //     let kodering = $(item).find('td:eq(0)').text().trim()
  //     row.kodering.kode = kodering

  //     if (kodering !== '' && kodering.split('.').length >= 6) {
  //         // get nama kodering 
  //          row.kodering.nama = $(item).find('td:eq(1)').text().trim().replace(/ +(?= )/g,'').replace(/\n/g,'')

  //         // push
  //         data.push(row)
  //     }
  //     else {
  //         let uraian = {
  //             nama: null,
  //             koefisien: null,
  //             satuan: null,
  //             harga: null,
  //             ppn: null,
  //             jumlah: null,
  //         }

  //         if (kodering === '') {
  //             // check if has 3 children
  //             if ($(item).children().length <=3) {
  //                 // tagging and keterangan
  //                 uraian.nama = $(item).find('td:eq(1)').text().trim().replace(/ +(?= )/g,'')
  //                 uraian.jumlah = $(item).find('td:eq(2)').text().trim().replace(/ +(?= )/g,'')

  //             } else {
  //                 // komponen
  //                 uraian.nama = $(item).find('td:eq(1)').text().trim().replace(/ +(?= )/g,'')
  //                 uraian.koefisien = $(item).find('td:eq(2)').text().trim().replace(/ +(?= )/g,'')
  //                 uraian.satuan = $(item).find('td:eq(3)').text().trim().replace(/ +(?= )/g,'')
  //                 uraian.harga = $(item).find('td:eq(4)').text().trim().replace(/ +(?= )/g,'')
  //                 uraian.ppn = $(item).find('td:eq(5)').text().trim().replace(/ +(?= )/g,'')
  //                 uraian.jumlah = $(item).find('td:eq(6)').text().trim().replace(/ +(?= )/g,'')
  //             } 

  //             // row.children.push(uraian)
  //             data[data.length - 1].children.push(uraian)

  //         }
  //     }

  //     // console.log($(item).find('td:eq(0)').text())
  // })
  // console.log(data)
  if (!info?.program && !isPrintPage) {
    return (
      <div className='w-80 pb-5'>
        <PageHeader
          ghost={true}
          title={<Typography.Title className='decorator-underline' level={2}> SIPD CRAWLER </Typography.Title>}
        />
        <div className='w-full flex flex-1 flex-col justify-center items-center px-3'>
          <Empty
            image="./image/empty.svg"
            imageStyle={{
              height: 60,
            }}
            description={
              <span className='font-semibold'>
                Mohon untuk masuk ke halaman cetak RKA terlebih dahulu
              </span>
            }
          />
        </div>
      </div>
    )
  }


  return (
    <div className='w-80 pb-5'>
      <PageHeader
        ghost={true}
        title={<Typography.Title className='decorator-underline' level={2}> SIPD CRAWLER </Typography.Title>}
      />
      <dl className='px-3'>
        <div className="px-3 py-1">
          <dt className="text-sm font-semibold text-gray-500">PROGRAM</dt>
          <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{info?.program}</dd>
        </div>
        <div className="px-3 py-1">
          <dt className="text-sm font-semibold text-gray-500">KEGIATAN</dt>
          <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{info?.kegiatan}</dd>
        </div>
        <div className="px-3 py-1">
          <dt className="text-sm font-semibold text-gray-500">SUB KEGIATAN</dt>
          <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{info?.subKegiatan}</dd>
        </div>
        <div className="px-3 py-1">
          <dt className="text-sm font-semibold text-gray-500">TOTAL PAGU</dt>
          <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{info?.totalPagu}</dd>
        </div>
        {/* <div className="px-3 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-3">
          <dt className="text-sm font-semibold text-gray-500">Roles </dt>
          <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0"> </dd>
        </div> */}
      </dl>
      <div className='px-5 mb-5'>
        <Button type='primary' block className='rounded-md' onClick={getBodyData}> Tarik Data </Button>
      </div>
    </div>
  );
}

export default App;
