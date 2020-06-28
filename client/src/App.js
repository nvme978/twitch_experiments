import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Header from './components/Header';
import Welcome from './components/Welcome';
import FavStreamer from './components/FavStreamer';
import Stream from './components/Stream';
import './App.css';

import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <Header/>
      <Route exact path='/' component={Welcome} />
      <Route exact path='/fav' component={FavStreamer} />
      <Route exact path='/stream' component={Stream} />
    </Router>
  );
}

export default App;
