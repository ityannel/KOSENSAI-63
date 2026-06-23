import './App.css'

function App() {
  return (
    <div className="festival-container">
      {/* PC Layout */}
      <div className="pc-layout">
        <div className="pc-content">
          <div className="pc-instagram-banner">
            <a href="https://www.instagram.com/kosen_gakuseikai/" target="_blank" rel="noopener noreferrer">
              <img 
                src="/assets/PC-instagram.png" 
                alt="@KOSEN_GAKUSEIKAI Instagram" 
                className="pc-instagram-img"
              />
            </a>
          </div>
          
          <div className="pc-main-visual">
            <img 
              src="/assets/PC.svg" 
              alt="函館高専祭 メインビジュアル" 
              className="pc-svg"
            />
          </div>
        </div>
      </div>

      {/* SP Layout */}
      <div className="sp-layout">
        <div className="sp-content">
          <div className="sp-instagram-banner">
            <a href="https://www.instagram.com/kosen_gakuseikai/" target="_blank" rel="noopener noreferrer">
              <img 
                src="/assets/SP-instagram.svg" 
                alt="@KOSEN_GAKUSEIKAI Instagram" 
                className="sp-instagram-img"
              />
            </a>
          </div>

          <div className="sp-main-visual">
            <img 
              src="/assets/SP.svg" 
              alt="函館高専祭 メインビジュアル" 
              className="sp-svg"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
