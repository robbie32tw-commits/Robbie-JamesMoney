import { useState, useEffect } from 'react';
import { uploadScriptFile, deleteScriptFile } from '../hooks/useScripts';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const EMPTY_FORM = {
  name: '',
  format: 'digital',
  author: '',
  location: '',
  quantity: 1,
  tags: [],
  notes: '',
  fileUrl: '',
  filePath: '',
  fileName: '',
};

export default function ScriptForm({ editing, onSave, onCancel, allTags }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || '',
        format: editing.format || 'digital',
        author: editing.author || '',
        location: editing.location || '',
        quantity: editing.quantity || 1,
        tags: editing.tags || [],
        notes: editing.notes || '',
        fileUrl: editing.fileUrl || '',
        filePath: editing.filePath || '',
        fileName: editing.fileName || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setTagInput('');
    setFileError('');
  }, [editing]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setFileError('只接受 PDF 檔案');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('檔案大小不可超過 25MB');
      return;
    }
    setFileError('');
    setUploading(true);
    try {
      if (form.filePath) {
        await deleteScriptFile(form.filePath);
      }
      const { fileUrl, filePath, fileName } = await uploadScriptFile(file);
      setForm((prev) => ({ ...prev, fileUrl, filePath, fileName }));
    } catch (err) {
      setFileError('上傳失敗，請再試一次');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = async () => {
    if (form.filePath) {
      await deleteScriptFile(form.filePath);
    }
    setForm((prev) => ({ ...prev, fileUrl: '', filePath: '', fileName: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || uploading) return;
    const isPaper = form.format === 'paper';
    if (isPaper && form.filePath) {
      deleteScriptFile(form.filePath);
    }
    onSave({
      ...form,
      name: form.name.trim(),
      author: form.author.trim(),
      location: form.location.trim(),
      notes: form.notes.trim(),
      quantity: isPaper ? Number(form.quantity) || 1 : 0,
      fileUrl: isPaper ? '' : form.fileUrl,
      filePath: isPaper ? '' : form.filePath,
      fileName: isPaper ? '' : form.fileName,
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editing ? '編輯劇本' : '新增劇本'}</h2>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>劇本名稱 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="輸入劇本名稱"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>格式</label>
            <div className="format-toggle">
              <button
                type="button"
                className={form.format === 'digital' ? 'active' : ''}
                onClick={() => handleChange('format', 'digital')}
              >
                💾 電子檔
              </button>
              <button
                type="button"
                className={form.format === 'paper' ? 'active' : ''}
                onClick={() => handleChange('format', 'paper')}
              >
                📄 紙本
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>作者/編劇</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => handleChange('author', e.target.value)}
                placeholder="作者名稱"
              />
            </div>
            <div className="form-group">
              <label>存放位置</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder={form.format === 'digital' ? '如：Google Drive' : '如：書架 A-3'}
              />
            </div>
          </div>

          {form.format === 'paper' && (
            <div className="form-group">
              <label>數量</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
              />
            </div>
          )}

          {form.format === 'digital' && (
            <div className="form-group">
              <label>PDF 檔案</label>
              {form.fileName ? (
                <div className="file-attached">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{form.fileName}</span>
                  <button type="button" className="remove-file-btn" onClick={handleRemoveFile}>
                    移除
                  </button>
                </div>
              ) : (
                <input type="file" accept="application/pdf" onChange={handleFileSelect} />
              )}
              {uploading && <p className="file-hint">上傳中...</p>}
              {fileError && <p className="file-error">{fileError}</p>}
            </div>
          )}

          <div className="form-group">
            <label>標籤</label>
            <div className="tag-input-row">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="輸入標籤後按 Enter"
                list="tag-suggestions"
              />
              <button type="button" className="add-tag-btn" onClick={addTag}>
                新增
              </button>
            </div>
            <datalist id="tag-suggestions">
              {allTags
                .filter((t) => !form.tags.includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
            {form.tags.length > 0 && (
              <div className="tag-list">
                {form.tags.map((tag) => (
                  <span key={tag} className="tag removable" onClick={() => removeTag(tag)}>
                    {tag} ✕
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>備註</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="其他備註..."
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="btn primary" disabled={uploading}>
              {editing ? '儲存修改' : '新增劇本'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
