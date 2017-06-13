"use strict";

var nodemailer = require("nodemailer");
var ejs = require("ejs");
var path = require("path");
var fs = require("fs");

var Execution = global.ExecutionClass;

function readFilePromise(type, file) {
  return new Promise(function (resolve, reject) {
    fs.readFile(file, function (err, data) {
      var res = {};
      if (err) {
        res[type] = err;
        reject(res);
      } else {
        res[type] = data;
        resolve(res);
      }
    });
  });
}

class mailExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(res) {
    var _this = this;
    var mail = res;
    mail.params = {};

    if (res.to) {

      mail.to = res.to.join(",");

      if (res.cc){
        mail.cc = res.cc.join(",");
      }

      if (res.bcc){
        mail.bcc = res.bcc.join(",");
      }

      mail.params.subject = res.title;
      mail.params.message = res.message;

      var templateDir = path.resolve(mail.templateDir, mail.template);
      var htmlTemplate = path.resolve(templateDir, "html.html");
      var txtTemplate = path.resolve(templateDir, "text.txt");

      Promise.all([
        readFilePromise("html", htmlTemplate),
        readFilePromise("text", txtTemplate)
      ])
        .then(
          async function (res) {

            var [html_data_file, text_data_file] = res;

            var html_data = html_data_file.html.toString();
            var text_data = text_data_file.text.toString();

            var options = {
              useArgsValues: true,
              useProcessValues: true,
              useGlobalValues: true,
              useExtraValue: mail.params
            };
            var [html, text] = await Promise.all([
              _this.paramsReplace(html_data, options),
              _this.paramsReplace(text_data, options)
            ]);

            if (mail.ejsRender) {
              html = ejs.render(html,mail);
              text = ejs.render(text,mail);
            }

            var mailOptions = {
              from: mail.from,
              to: mail.to,
              cc: mail.cc,
              bcc: mail.bcc,
              subject: mail.params.subject,
              text: text,
              html: html,
              attachments: mail.attachments
            };

            if (mail.disable) {
              _this.logger.log("warn", "Mail sender is disable.");
              var endOptions = {
                end: "end",
                messageLogType: "warn",
                messageLog:  "Mail sender is disable.",
                execute_err_return:  "Mail sender is disable.",
                execute_return: "Mail sender is disable."
              };
              _this.end(endOptions);
            } else {
              var transport = nodemailer.createTransport(mail.transport);

              transport.sendMail(mailOptions,
                function (err) {
                  if (err) {
                    var endOptions = {
                      end: "error",
                      messageLog: `Error sending mail (sendMail): ${JSON.stringify(err)}`,
                      execute_err_return: `Error sending mail: ${JSON.stringify(err)}`
                    };

                    _this.end(endOptions);
                  } else {
                    _this.end();
                  }
                });
            }
          })
        .catch(function (err) {
          var endOptions = {
            end: "error",
            messageLog:  `Error sending mail: ${JSON.stringify(err)}`,
            execute_err_return: `Error sending mail: ${JSON.stringify(err)}`,
          };
          _this.end(endOptions);
        });

    } else {
      var endOptions = {
        end: "error",
        messageLog:  "Error Mail to not setted.",
        execute_err_return:  "Error Mail to not setted.",
        execute_return: ""
      };
      _this.end(endOptions);
    }
  }
}

module.exports = mailExecutor;
