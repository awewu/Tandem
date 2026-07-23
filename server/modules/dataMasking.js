function maskSensitiveData(data, type) {
  if (!data) return data;

  switch (type) {
    case 'phone':
      return String(data).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    case 'idCard':
      return String(data).replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
    case 'email': {
      const [user = '', domain = ''] = String(data).split('@');
      if (!domain) return data;
      const maskedUser = user.length <= 3
        ? user[0] + '***'
        : user.substring(0, 2) + '***' + user.substring(user.length - 1);
      return `${maskedUser}@${domain}`;
    }
    case 'name':
      return String(data).substring(0, 1) + '**';
    case 'password':
      return '********';
    default:
      return data;
  }
}

function maskSensitiveInLog(logData) {
  if (typeof logData !== 'string') return logData;
  return logData
    .replace(/"phone":\s*"\d{11}"/g, '"phone":"***********"')
    .replace(/"password":\s*"[^"]*"/g, '"password":"********"')
    .replace(/"token":\s*"[^"]*"/g, '"token":"********"');
}

module.exports = {
  maskSensitiveData,
  maskSensitiveInLog
};
