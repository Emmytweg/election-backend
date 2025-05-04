const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  votes: {
    type: Map,
    of: String  // position => candidateId
  }
});

module.exports = mongoose.model('Vote', voteSchema);
