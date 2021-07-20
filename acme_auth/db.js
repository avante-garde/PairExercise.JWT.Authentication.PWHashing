const Sequelize = require('sequelize');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const { STRING } = Sequelize;
const config = {
  logging: false
};

if(process.env.LOGGING){
  delete config.logging;
}
const conn = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/acme_db', config);

const User = conn.define('user', {
  username: STRING,
  password: STRING
});

User.prototype.generateToken = async function () {
  try {
    const token = await jwt.sign({ id: this.id}, process.env.JWT);
    return {token}
  } catch (e) {
    console.error(e)
  }
}

User.byToken = async(token)=> {
  try {
    const data = jwt.verify(token, process.env.JWT)
    if(data){
      const user = await User.findByPk(data.userId);
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
  catch(ex){
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async({ username, password })=> {
  const user = await User.findOne({
    where: {
      username
    }
  });
  const isValid = await bcrypt.compare(password, user.password)
  if(isValid){
    return user;
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

User.beforeCreate (async (user) => {
    const SALT_COUNT = 5;
    const hashedPwd = await bcrypt.hash(user.password, SALT_COUNT)
    user.password = hashedPwd
})

const Note = conn.define('note', {
   text: STRING,
  });

Note.belongsTo(User)
User.hasMany(Note)

const notes = [{
    text: 'banana'
}, {
    text: 'potato'
}, {
    text: 'secretKey'
}]

const syncAndSeed = async()=> {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw'},
    { username: 'moe', password: 'moe_pw'},
    { username: 'larry', password: 'larry_pw'}
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map( credential => User.create(credential))
  );
  const [banana, potato, secretKey] = await Promise.all(notes.map(note => Note.create(note)))
  await lucy.setNotes(banana)
  await moe.setNotes(secretKey)
  await larry.setNotes(potato)
  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
        banana,
        potato,
        secretKey
    }
  };
};



module.exports = {
  syncAndSeed,
  models: {
    User,
    Note
  }
};