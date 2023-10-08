/*
阿里云盘自动签到工具
*/

const accesssTokenURL = "https://auth.aliyundrive.com/v2/account/token"
const siginURL = "https://member.aliyundrive.com/v1/activity/sign_in_list"
const rewardURL = 'https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile'

function aliyunCheckin() {
    // 从 google 表格中获取 refresh_token 列表
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getRange(1, 1, sheet.getLastRow()).getValues();
    const refreshTokenList = range.map(function (i) {
        return i[0];
    });
    const message = {};
    for (const index in refreshTokenList) {
        try {
            const queryBody = {
                'grant_type': 'refresh_token',
                'refresh_token': refreshTokenList[index]
            };
            // 使用 refresh_token 获取 access_token
            const accessRep = UrlFetchApp.fetch(accesssTokenURL, {
                'method': 'POST',
                'contentType': 'application/json; charset=UTF-8',
                'payload': JSON.stringify(queryBody)
            });
            const accessToken = JSON.parse(accessRep).access_token;
            const newRefeshToken = JSON.parse(accessRep).refresh_token;
            //需转换为数字1，不然index拼接会变成11
            var _index = parseInt(index) + 1;
            sheet.getRange(_index, 1).setValue(newRefeshToken);
            const nickName = JSON.parse(accessRep).nick_name;
            // 签到
            try {
                const checkRep = UrlFetchApp.fetch(siginURL, {
                    'method': 'POST',
                    'contentType': 'application/json; charset=UTF-8',
                    'payload': JSON.stringify(queryBody),
                    'headers': {
                        'Authorization': 'Bearer ' + accessToken
                    }
                });
                const {signInLogs, signInCount} = JSON.parse(checkRep).result;
                const signInArray = signInLogs.filter(function (day) {
                    return day.status === 'normal' && !day.isReward;
                }); //获取当月签到的记录(默认当前是签到当天)
                let signInReward = '空气';
                if (signInArray.length > 1) {
                    const currentSignIn = signInArray[signInArray.length - 1];
                    //领取奖励
                    const rewardDay = {
                        'signInDay': currentSignIn.day
                    };
                    const rewardRep = UrlFetchApp.fetch(rewardURL, {
                        'method': 'POST',
                        'contentType': 'application/json; charset=UTF-8',
                        'payload': JSON.stringify(rewardDay),
                        'headers': {
                            'Authorization': 'Bearer ' + accessToken
                        }
                    });
                    const rewardRes = JSON.parse(rewardRep).result;
                    if (rewardRes.name != null) {
                        signInReward = rewardRes.name + rewardRes.description;
                    }
                    

                }
                message['账号： ' + nickName] = {
                    '本月已签到': signInCount,
                    '签到奖励': signInReward
                };
            } catch (e) {
                message['账号： ' + nickName] = {
                    '签到失败，错误信息': e
                };
                break;
            }
            
        } catch (e) {
            message['账号编号： ' + String(index + 1)] = {
                '获取 access_token 失败，错误信息': e
            };
            break;
        }
        
    }
    
    // 将签到的信息发送至邮箱
    const email = Session.getActiveUser().getEmail();
    const htmlTemplate = HtmlService.createTemplateFromFile('Index');
    htmlTemplate.data = message;
    const htmlBody = htmlTemplate.evaluate().getContent();
    const subject = '阿里云盘签到——' + Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd");
    GmailApp.sendEmail(email, subject, '', {
        htmlBody: htmlBody
    })
}
