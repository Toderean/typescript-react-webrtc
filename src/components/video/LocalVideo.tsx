import React from 'react';

interface Props {
  stream: MediaStream | null;
}

const LocalVideo: React.FC<Props> = ({ stream }) => {
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={ref} autoPlay muted className="w-100 border" />;
};

export default LocalVideo;
