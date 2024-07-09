// CardComponent.js
import React from 'react';
import { FaDownload, FaCloudUploadAlt, FaPlay, FaPause } from 'react-icons/fa';

const CardComponent = ({
  handleFileUpload,
  selectedFile,
  firebaseFiles,
  handleSelectChange,
  handleExportToLocal,
  handleExportToFirebase,
  toggleAnimation,
  isAnimationPlaying,
  loading,
}) => {
  return (
    <div className="card">
      <input
        type="file"
        onChange={handleFileUpload}
        style={{ fontSize: '18px', padding: '10px', marginBottom: '20px' }}
      />

      <select
        value={selectedFile ? selectedFile.name : ''}
        onChange={handleSelectChange}
        style={{ fontSize: '18px', padding: '10px', marginBottom: '20px', color: 'black', backgroundColor: '#61dafb', cursor: 'pointer' }}
      >
        <option value="">Select a file from Firebase</option>
        {firebaseFiles.map(file => (
          <option key={file.name} value={file.name}>{file.name}</option>
        ))}
      </select>

        <br></br>
      <button onClick={handleExportToLocal} style={{ fontSize: '18px', padding: '10px', marginBottom: '20px' }} title="Export to Local">
        <FaDownload style={{ marginRight: '8px' }} />
      </button>

      <button onClick={handleExportToFirebase} style={{ fontSize: '18px', padding: '10px', marginBottom: '20px' }} title="Export to Firebase">
        <FaCloudUploadAlt style={{ marginRight: '8px' }} />
      </button>

      <button onClick={toggleAnimation} style={{ fontSize: '18px', padding: '10px', marginBottom: '20px' }} title={isAnimationPlaying ? "Pause Animation" : "Play Animation"}>
        {isAnimationPlaying ? <FaPause style={{ marginRight: '8px' }} /> : <FaPlay style={{ marginRight: '8px' }} />}
      </button>

      {loading && <p style={{ color: 'white', fontSize: '18px' }}>Loading...</p>}
    </div>
  );
};

export default CardComponent;
