import React, {useState, useEffect} from 'react';
import { Container, InputGroup, FormControl, Button, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import _ from 'lodash';
import api from '../api';

function FavStreamer() {

    const [username, setUsername] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    const currentStreamer = localStorage.getItem('fav_streamer');
    const [requestedUser, setRequestedUser] = useState(currentStreamer ? JSON.parse(currentStreamer) : null);

    useEffect(() => {
        const jwt = localStorage.getItem('jwt_token');
        console.log(jwt);
        if(jwt && jwt != '') {
            setIsAuthenticated(true);
        }   
    }, [])

    const getTwitchUserDetails = async () => {
        let result = null;
        try {
            result = await api.get('https://api.twitch.tv/helix/users?login=' + username);
        } catch (err) {
            // Try refreshing the token
            let creds = await api.post('/auth/refresh_token');
            localStorage.setItem('access_token', creds.data.accessToken);
            result = await api.get('https://api.twitch.tv/helix/users?login=' + username);
        }
        if (_.isEmpty(result.data.data)) {
            alert('No user found');
            setRequestedUser(null);
        } else {
            setRequestedUser(result.data.data[0]);
            localStorage.setItem('fav_streamer', JSON.stringify(result.data.data[0]));
        }
    }

    const handleTextChange = (event) => {
        setUsername(event.target.value);
    }

    return (
        <Container>
        {isAuthenticated ? 
            <Row className="align-items-center">
                <Col>
                    <InputGroup className="mb-3">
                        <InputGroup.Prepend>
                            <InputGroup.Text id="basic-addon1">@</InputGroup.Text>
                        </InputGroup.Prepend>
                        <FormControl
                            type='text'
                            onChange={(event) => handleTextChange(event)}
                            value={username}
                            placeholder="Username"
                            aria-label="Username"
                            aria-describedby="basic-addon1"
                        />
                    </InputGroup>
                    <Row>
                        <Col>
                            <Button variant="success" onClick={getTwitchUserDetails}>Get streamer</Button>
                        </Col>
                        <Col>
                            <Button as={Link} to="/stream">View stream</Button>
                        </Col>
                    </Row>
                </Col>
                <Col>
                    { requestedUser && 
                        <div>
                            <img src={requestedUser.profile_image_url} />
                            <p>{requestedUser.description}</p>
                        </div>
                    }
                </Col>
            </Row>:
            <p>Please login first</p>}
        </Container>
    )
}

export default FavStreamer;