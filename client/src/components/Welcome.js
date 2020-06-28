import React, {useEffect, useState} from 'react';
import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import _ from 'lodash';
import api from '../api';

function Welcome() {

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [userName, setUserName] = useState(null)

    useEffect(() => {
        const checkForAuth = async () => {
            let result = await api.get('/auth/user');
            console.log(result.data);
            if (_.isEmpty(result.data)) {
                // User is not logged in - Show appropriate message
                localStorage.setItem('jwt_token', '');
                localStorage.setItem('access_token', '');
            } else {
                localStorage.setItem('access_token', result.data.user.accessToken);
                localStorage.setItem('jwt_token', result.data.token);
                setIsAuthenticated(true);
                setUserName(result.data.user.data[0].display_name);
                
            }
            
        }
        checkForAuth();
    }, [])

    return (
        <Container fluid style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            { !isAuthenticated ? 
                <a href={process.env.REACT_APP_SERVER_BASE_URL + '/auth/twitch'}>Login to Twitch</a> :
                <div>
                    <p>Welcome to Stonks Fintech, {userName}</p>
                    <Button variant='success' as={Link} to='/fav'>Set fav streamer</Button>
                </div>
            }
        </Container>
    )
}

export default Welcome;