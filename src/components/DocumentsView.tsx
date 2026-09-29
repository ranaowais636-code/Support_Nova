import React, { useState, useEffect } from 'react';
import { User, PolicyDocument } from '../types';
import { api } from '../api';
import { BookOpen, Upload, Search, FileText, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface DocumentsViewProps {
  user: User;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ user }) => {
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  // Upload modal state (ADMIN ONLY)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [docId, setDocId] = useState('');
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('Policy');
  const [section, setSection] = useState('1.0');
  const [version, setVersion] = useState('v1.0');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('Corporate Policy Directorate');
  const [status, setStatus] = useState<'Active' | 'Superseded' | 'Outdated' | 'Draft'>('Active');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isAdmin = user.role === 'Administrator';

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    try {
      let fileData = '';
      if (selectedFile) {
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Unable to read the selected file.'));
          reader.readAsDataURL(selectedFile);
        });
      }

      const res = await api.uploadDocument({
        id: docId,
        title,
        type: docType,
        section,
        version,
        effective_date: effectiveDate,
        source,
        status,
        content,
        filename: selectedFile?.name,
        file_data: fileData,
      });

      setUploadSuccess(`Document ${res.document_id} uploaded successfully with ${res.chunks_created} traceable chunks.`);
      setDocId('');
      setTitle('');
      setContent('');
      setSelectedFile(null);
      await loadDocuments();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess(null);
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter(
    (d) =>
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.source.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[#E2DCF0]">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#6C4AB6]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#171A3A]">Documents & Knowledge Base</h1>
          </div>
          <p className="text-xs text-[#555E7A] mt-1">
            Official company policy documents, standard operating procedures, and traceable ground-truth chunks.
          </p>
        </div>

        {/* Upload Button: ADMINISTRATOR ONLY */}
        {isAdmin && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 bg-[#6C4AB6] hover:bg-[#593A9C] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 mr-2" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E2DCF0] shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#79819A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by ID, title, or source authority..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#F4F1FA] border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
          />
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-[#E2DCF0] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#79819A]">Loading Knowledge Base documents...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#79819A]">No policy documents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F4F1FA] text-[#555E7A] border-b border-[#E2DCF0]">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Document ID</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Version</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Effective Date</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBF9]">
                {filteredDocs.map((doc) => {
                  const isExpanded = expandedDocId === doc.id;
                  return (
                    <React.Fragment key={doc.id}>
                      <tr className="hover:bg-[#F9F8FC] transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#171A3A]">{doc.id}</td>
                        <td className="px-4 py-3 font-semibold text-[#171A3A] max-w-xs">{doc.title}</td>
                        <td className="px-4 py-3 text-[#555E7A]">{doc.doc_type}</td>
                        <td className="px-4 py-3 font-mono font-medium text-[#171A3A]">{doc.version}</td>
                        <td className="px-4 py-3 text-[#79819A]">{doc.effective_date}</td>
                        <td className="px-4 py-3 text-[#555E7A] max-w-xs truncate">{doc.source}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              doc.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                            className="inline-flex items-center px-2 py-1 text-xs text-[#6C4AB6] hover:bg-[#EDE7F6] rounded border border-[#D3C7EE] transition-colors"
                          >
                            <span>{isExpanded ? 'Hide Chunks' : 'Inspect'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 ml-1" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 ml-1" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Chunk & Content Inspection */}
                      {isExpanded && (
                        <tr className="bg-[#FAF9FD]">
                          <td colSpan={8} className="px-6 py-4 border-b border-[#E2DCF0]">
                            <div className="space-y-4">
                              <div className="p-3.5 rounded-lg bg-white border border-[#E2DCF0] text-xs">
                                <span className="font-bold text-[#171A3A] block mb-1">Document Full Content:</span>
                                <p className="text-[#444D6E] leading-relaxed whitespace-pre-wrap">{doc.content}</p>
                              </div>

                              <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-[#171A3A] block mb-2">
                                  Parsed Traceable Chunks ({doc.chunks?.length || 0}):
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {doc.chunks?.map((chunk) => (
                                    <div
                                      key={chunk.id}
                                      className="p-3 rounded-lg bg-white border border-[#E2DCF0] text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between font-semibold text-[#171A3A]">
                                        <span>Section {chunk.section}: {chunk.heading}</span>
                                        <span className="font-mono text-[10px] text-[#79819A]">{chunk.page_ref}</span>
                                      </div>
                                      <p className="text-[#555E7A] text-[11px] leading-relaxed">{chunk.chunk_text}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Upload Document Modal */}
      {showUploadModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-[#171A3A]/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E2DCF0] space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F0EBF9] pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-[#6C4AB6]" />
                <h3 className="text-base font-bold text-[#171A3A]">Upload New Policy Document</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-[#79819A] hover:text-[#171A3A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                {uploadSuccess}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Document ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                    placeholder="e.g. RET-POL-21"
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. In-Store Return Standards"
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs"
                  >
                    <option value="Policy">Policy</option>
                    <option value="SOP">Standard Operating Procedure (SOP)</option>
                    <option value="KnowledgeBase">Knowledge Base FAQ</option>
                    <option value="SLA">Service Level Agreement (SLA)</option>
                    <option value="Compliance">Compliance Guideline</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Section Code
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. 1.0 - 1.5"
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g. v1.0"
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Source Authority
                  </label>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g. Operations Board"
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                    Lifecycle Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#D3C7EE] rounded-lg text-xs"
                  >
                    <option value="Active">Active</option>
                    <option value="Superseded">Superseded</option>
                    <option value="Outdated">Outdated</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0]">
                <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                  Source File (PDF or DOCX)
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#555E7A]"
                />
                <p className="text-[10px] text-[#79819A] mt-1">
                  The backend extracts text, preserves page/section references, and creates traceable chunks. Manual text remains supported below.
                </p>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-[#444D6E] mb-1">
                  Document Content (Optional when a PDF/DOCX is selected)
                </label>
                <textarea
                  required={!selectedFile}
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste complete policy text or SOP sections here..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-[#D3C7EE] text-[#444D6E] rounded-lg hover:bg-[#F4F1FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-[#6C4AB6] text-white rounded-lg font-semibold hover:bg-[#593A9C] disabled:opacity-50"
                >
                  {uploading ? 'Processing & Chunking...' : 'Save & Publish Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
