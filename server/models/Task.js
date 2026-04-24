const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  path: String,
  size: Number,
  mimetype: String
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'completed'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dueDate: {
    type: Date
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [attachmentSchema],
  comments: [commentSchema]
}, {
  timestamps: true
});

// Static methods
taskSchema.statics.findAll = function(options = {}) {
  const { status, priority, assignedTo, page = 1, limit = 10 } = options;
  
  let query = this.find();
  
  if (status) query = query.where('status').equals(status);
  if (priority) query = query.where('priority').equals(priority);
  if (assignedTo) query = query.where('assignedTo').equals(assignedTo);
  
  return query
    .populate('assignedTo', 'username email firstName lastName')
    .populate('createdBy', 'username email firstName lastName')
    .populate('comments.author', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

taskSchema.statics.countAll = function(options = {}) {
  const { status, priority, assignedTo } = options;
  
  let query = this.countDocuments();
  
  if (status) query = query.where('status').equals(status);
  if (priority) query = query.where('priority').equals(priority);
  if (assignedTo) query = query.where('assignedTo').equals(assignedTo);
  
  return query;
};

taskSchema.statics.findMyTasks = function(userId, options = {}) {
  const { status, page = 1, limit = 10 } = options;
  
  let query = this.find({ assignedTo: userId });
  
  if (status) query = query.where('status').equals(status);
  
  return query
    .populate('createdBy', 'username email firstName lastName')
    .populate('comments.author', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

taskSchema.statics.countMyTasks = function(userId, options = {}) {
  const { status } = options;
  
  let query = this.countDocuments({ assignedTo: userId });
  
  if (status) query = query.where('status').equals(status);
  
  return query;
};

taskSchema.statics.addComment = function(taskId, commentData) {
  const { text, authorId } = commentData;
  
  return this.findByIdAndUpdate(
    taskId,
    { $push: { comments: { text, author: authorId } } },
    { new: true }
  ).populate('comments.author', 'username firstName lastName');
};

taskSchema.statics.addAttachment = function(taskId, attachmentData) {
  const { filename, originalName, path, size, mimetype } = attachmentData;
  
  return this.findByIdAndUpdate(
    taskId,
    { $push: { attachments: { filename, originalName, path, size, mimetype } } },
    { new: true }
  );
};

taskSchema.statics.addTagsToTask = function(taskId, tags) {
  return this.findByIdAndUpdate(
    taskId,
    { $addToSet: { tags: { $each: tags } } },
    { new: true }
  );
};

module.exports = mongoose.model('Task', taskSchema);
